/**
 * merge-airports.js
 *
 * Merges airport data from ip2location CSV into airports.json
 * - Adds missing airports (by ICAO code)
 * - Fills in missing fields for existing airports
 * - NEVER overwrites existing data
 *
 * Usage: node scripts/merge-airports.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const AIRPORTS_JSON = path.join(DATA_DIR, 'airports.json');
const CSV_FILE = path.join(DATA_DIR, 'ip2location-iata-icao', 'iata-icao.csv');

// Stats tracking
const stats = {
  csvTotal: 0,
  skippedNoIcao: 0,
  skippedInvalidIcao: 0,
  newAirports: 0,
  updatedAirports: 0,
  fieldsAdded: {
    iata: 0,
    name: 0,
    city: 0,
    lat: 0,
    lon: 0
  }
};

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Validate ICAO code (2-4 uppercase letters)
 */
function isValidIcao(icao) {
  return icao && /^[A-Z]{2,4}$/.test(icao);
}

/**
 * Read and parse CSV file
 */
function readCSV() {
  const content = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header
  const header = parseCSVLine(lines[0]);
  console.log('CSV Headers:', header.join(', '));

  const airports = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length < 7) continue;

    const [countryCode, regionName, iata, icao, airportName, latitude, longitude] = values;

    stats.csvTotal++;

    // Skip entries without ICAO
    if (!icao) {
      stats.skippedNoIcao++;
      continue;
    }

    // Skip invalid ICAO codes
    if (!isValidIcao(icao)) {
      stats.skippedInvalidIcao++;
      continue;
    }

    airports.push({
      icao: icao,
      iata: iata || null,
      name: airportName || null,
      city: regionName || null,
      lat: latitude ? parseFloat(latitude) : null,
      lon: longitude ? parseFloat(longitude) : null
    });
  }

  return airports;
}

/**
 * Merge CSV data into existing airports
 */
function mergeAirports(existing, csvAirports) {
  // Create lookup by ICAO
  const byIcao = new Map();
  existing.forEach(airport => {
    byIcao.set(airport.icao, airport);
  });

  for (const csvAirport of csvAirports) {
    const existingAirport = byIcao.get(csvAirport.icao);

    if (!existingAirport) {
      // New airport - add it if it has meaningful data
      if (csvAirport.name || csvAirport.lat !== null) {
        const newAirport = { icao: csvAirport.icao };

        if (csvAirport.iata) newAirport.iata = csvAirport.iata;
        if (csvAirport.name) newAirport.name = csvAirport.name;
        if (csvAirport.city) newAirport.city = csvAirport.city;
        if (csvAirport.lat !== null && !isNaN(csvAirport.lat)) newAirport.lat = csvAirport.lat;
        if (csvAirport.lon !== null && !isNaN(csvAirport.lon)) newAirport.lon = csvAirport.lon;

        byIcao.set(csvAirport.icao, newAirport);
        stats.newAirports++;
      }
    } else {
      // Existing airport - fill in missing fields only
      let updated = false;

      if (!existingAirport.iata && csvAirport.iata) {
        existingAirport.iata = csvAirport.iata;
        stats.fieldsAdded.iata++;
        updated = true;
      }

      if (!existingAirport.name && csvAirport.name) {
        existingAirport.name = csvAirport.name;
        stats.fieldsAdded.name++;
        updated = true;
      }

      if (!existingAirport.city && csvAirport.city) {
        existingAirport.city = csvAirport.city;
        stats.fieldsAdded.city++;
        updated = true;
      }

      if (existingAirport.lat === undefined && csvAirport.lat !== null && !isNaN(csvAirport.lat)) {
        existingAirport.lat = csvAirport.lat;
        stats.fieldsAdded.lat++;
        updated = true;
      }

      if (existingAirport.lon === undefined && csvAirport.lon !== null && !isNaN(csvAirport.lon)) {
        existingAirport.lon = csvAirport.lon;
        stats.fieldsAdded.lon++;
        updated = true;
      }

      if (updated) {
        stats.updatedAirports++;
      }
    }
  }

  // Convert back to array and sort by ICAO
  return Array.from(byIcao.values()).sort((a, b) => a.icao.localeCompare(b.icao));
}

/**
 * Main function
 */
function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Airport Database Merge Script');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n*** DRY RUN MODE - No changes will be written ***\n');
  }

  // Read existing airports.json
  console.log(`\nReading existing airports from: ${AIRPORTS_JSON}`);
  const existing = JSON.parse(fs.readFileSync(AIRPORTS_JSON, 'utf8'));
  console.log(`  Found ${existing.length} existing airports`);

  // Read CSV
  console.log(`\nReading CSV from: ${CSV_FILE}`);
  const csvAirports = readCSV();
  console.log(`  Parsed ${csvAirports.length} valid airports from CSV`);

  // Merge
  console.log('\nMerging data...');
  const merged = mergeAirports(existing, csvAirports);

  // Print stats
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`\nCSV Processing:`);
  console.log(`  Total entries in CSV:     ${stats.csvTotal}`);
  console.log(`  Skipped (no ICAO):        ${stats.skippedNoIcao}`);
  console.log(`  Skipped (invalid ICAO):   ${stats.skippedInvalidIcao}`);

  console.log(`\nMerge Results:`);
  console.log(`  New airports added:       ${stats.newAirports}`);
  console.log(`  Existing airports updated:${stats.updatedAirports}`);

  console.log(`\nFields added to existing airports:`);
  console.log(`  IATA codes:               ${stats.fieldsAdded.iata}`);
  console.log(`  Names:                    ${stats.fieldsAdded.name}`);
  console.log(`  Cities:                   ${stats.fieldsAdded.city}`);
  console.log(`  Latitudes:                ${stats.fieldsAdded.lat}`);
  console.log(`  Longitudes:               ${stats.fieldsAdded.lon}`);

  console.log(`\nFinal airport count:        ${merged.length} (was ${existing.length})`);

  // Write result
  if (!dryRun) {
    // Backup original
    const backupPath = AIRPORTS_JSON + '.backup';
    fs.copyFileSync(AIRPORTS_JSON, backupPath);
    console.log(`\nBackup created: ${backupPath}`);

    // Write merged data
    fs.writeFileSync(AIRPORTS_JSON, JSON.stringify(merged, null, 2) + '\n');
    console.log(`Updated: ${AIRPORTS_JSON}`);
  } else {
    console.log('\n*** DRY RUN - No files were modified ***');
  }

  console.log('\nDone!');
}

main();
