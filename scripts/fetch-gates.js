#!/usr/bin/env node
/**
 * Fetch airport gates from OpenStreetMap using Overpass API
 * Creates a gates database from airports.json
 *
 * Usage: node scripts/fetch-gates.js [--force]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const AIRPORTS_FILE = path.join(__dirname, '../data/airports.json');
const GATES_FILE = path.join(__dirname, '../data/gates.json');

// Multiple Overpass API servers for fallback
const OVERPASS_SERVERS = [
  'overpass-api.de',
  'overpass-turbo.osm.ch',
  'overpass.kumi.systems'
];

// Bounding box size around airport (in degrees, ~2.2km radius)
const BBOX_SIZE = 0.02;

// Delay between requests to avoid rate limiting (ms)
const REQUEST_DELAY = 2000;

// Max retries for failed requests
const MAX_RETRIES = 3;

/**
 * Make a single request to an Overpass server
 */
function makeOverpassRequest(server, query) {
  return new Promise((resolve, reject) => {
    const postData = `data=${encodeURIComponent(query)}`;

    const options = {
      hostname: server,
      port: 443,
      path: '/api/interpreter',
      method: 'POST',
      timeout: 65000, // 65s timeout for the request itself
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'VATSIM-Deparr-GateFetcher/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => { data += chunk; });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, data });
        } else {
          resolve({ success: false, error: `HTTP ${res.statusCode}`, retryable: res.statusCode >= 500 });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout', retryable: true });
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message, retryable: true });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Fetch gates for a single airport from Overpass API with retry logic
 */
async function fetchGatesForAirport(airport) {
  const { icao, lat, lon } = airport;

  // Build bounding box around airport
  const south = lat - BBOX_SIZE;
  const north = lat + BBOX_SIZE;
  const west = lon - BBOX_SIZE;
  const east = lon + BBOX_SIZE;

  // Overpass query for gates and parking positions (60s timeout)
  const query = `
    [out:json][timeout:60];
    (
      node["aeroway"="gate"](${south},${west},${north},${east});
      node["aeroway"="parking_position"](${south},${west},${north},${east});
    );
    out body;
  `.trim();

  // Try each server with retries
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const server = OVERPASS_SERVERS[attempt % OVERPASS_SERVERS.length];

    const result = await makeOverpassRequest(server, query);

    if (result.success) {
      try {
        const json = JSON.parse(result.data);
        const gates = parseGates(json.elements, icao);
        return { icao, gates };
      } catch (e) {
        return { icao, gates: [], error: `Parse error: ${e.message}` };
      }
    }

    // If not retryable (4xx error), don't retry
    if (!result.retryable) {
      return { icao, gates: [], error: result.error };
    }

    // Wait before retry (exponential backoff)
    if (attempt < MAX_RETRIES - 1) {
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await sleep(waitTime);
    }
  }

  return { icao, gates: [], error: 'Max retries exceeded' };
}

/**
 * Parse OSM elements into gate objects
 */
function parseGates(elements, icao) {
  if (!elements || !Array.isArray(elements)) return [];

  const gates = [];

  for (const el of elements) {
    if (el.type !== 'node' || !el.tags) continue;

    // Get gate reference (name/number)
    const ref = el.tags.ref || el.tags.name || null;
    if (!ref) continue; // Skip gates without a reference

    gates.push({
      ref: ref,
      lat: el.lat,
      lon: el.lon,
      type: el.tags.aeroway, // 'gate' or 'parking_position'
      terminal: el.tags.terminal || null
    });
  }

  // Sort by ref for easier reading
  gates.sort((a, b) => {
    // Try numeric sort first
    const numA = parseInt(a.ref, 10);
    const numB = parseInt(b.ref, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.ref.localeCompare(b.ref);
  });

  return gates;
}

/**
 * Sleep for ms milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
  const forceRefresh = process.argv.includes('--force');

  // Load airports
  console.log('Loading airports database...');
  const airports = JSON.parse(fs.readFileSync(AIRPORTS_FILE, 'utf8'));
  console.log(`Found ${airports.length} airports`);

  // Load existing gates database if exists and not forcing
  let existingGates = {};
  if (!forceRefresh && fs.existsSync(GATES_FILE)) {
    try {
      existingGates = JSON.parse(fs.readFileSync(GATES_FILE, 'utf8'));
      console.log(`Loaded existing gates for ${Object.keys(existingGates).length} airports`);
    } catch (e) {
      console.log('Could not load existing gates file, starting fresh');
    }
  }

  // Determine which airports need fetching
  const toFetch = forceRefresh
    ? airports
    : airports.filter(a => !existingGates[a.icao]);

  if (toFetch.length === 0) {
    console.log('All airports already have gate data. Use --force to refresh.');
    return;
  }

  console.log(`\nFetching gates for ${toFetch.length} airports...`);
  console.log('This may take a while due to API rate limiting.\n');

  const gatesDb = { ...existingGates };
  let successCount = 0;
  let gateCount = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const airport = toFetch[i];
    const progress = `[${i + 1}/${toFetch.length}]`;

    process.stdout.write(`${progress} Fetching ${airport.icao} (${airport.name})... `);

    const result = await fetchGatesForAirport(airport);

    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else if (result.gates.length === 0) {
      console.log('No gates found');
    } else {
      console.log(`${result.gates.length} gates`);
      successCount++;
      gateCount += result.gates.length;
    }

    // Store result (even if empty, so we don't retry)
    gatesDb[airport.icao] = {
      gates: result.gates,
      fetchedAt: new Date().toISOString()
    };

    // Save progress periodically (every 10 airports)
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(GATES_FILE, JSON.stringify(gatesDb, null, 2));
      console.log('  [Progress saved]');
    }

    // Rate limiting delay
    if (i < toFetch.length - 1) {
      await sleep(REQUEST_DELAY);
    }
  }

  // Final save
  fs.writeFileSync(GATES_FILE, JSON.stringify(gatesDb, null, 2));

  console.log('\n========================================');
  console.log(`Completed! Results saved to ${GATES_FILE}`);
  console.log(`Airports with gates: ${successCount}/${toFetch.length}`);
  console.log(`Total gates found: ${gateCount}`);
  console.log('========================================');
}

main().catch(console.error);
