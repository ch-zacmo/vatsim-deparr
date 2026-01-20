/**
 * VATSIM Data Service
 * Fetches and caches data from VATSIM API
 */

// Configuration from environment (with defaults)
const VATSIM_API_URL = process.env.VATSIM_API_URL || 'https://data.vatsim.net/v3/vatsim-data.json';
const POLL_INTERVAL = parseInt(process.env.VATSIM_POLL_INTERVAL) || 15000; // 15 seconds minimum

let cachedData = null;
let lastFetch = 0;
let pollingInterval = null;

/**
 * Fetch fresh data from VATSIM API
 */
async function fetchData() {
  try {
    const response = await fetch(VATSIM_API_URL);
    if (!response.ok) {
      throw new Error(`VATSIM API error: ${response.status}`);
    }
    cachedData = await response.json();
    lastFetch = Date.now();
    console.log(`VATSIM data updated: ${cachedData.pilots?.length || 0} pilots online`);
  } catch (error) {
    console.error('Failed to fetch VATSIM data:', error.message);
  }
}

/**
 * Start periodic polling
 */
function startPolling() {
  if (pollingInterval) return;

  // Initial fetch
  fetchData();

  // Poll every 15 seconds
  pollingInterval = setInterval(fetchData, POLL_INTERVAL);
  console.log('VATSIM data polling started');
}

/**
 * Stop polling
 */
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Get cached data
 */
function getData() {
  return cachedData;
}

/**
 * Get all pilots
 */
function getPilots() {
  return cachedData?.pilots || [];
}

/**
 * Get all prefiles (filed flight plans, not yet connected)
 */
function getPrefiles() {
  return cachedData?.prefiles || [];
}

/**
 * Get departures for an airport
 * @param {string} icao - Airport ICAO code
 */
function getDepartures(icao) {
  const code = icao.toUpperCase();
  const pilots = getPilots().filter(p =>
    p.flight_plan?.departure?.toUpperCase() === code
  );
  const prefiles = getPrefiles().filter(p =>
    p.flight_plan?.departure?.toUpperCase() === code
  );
  return { pilots, prefiles };
}

/**
 * Get arrivals for an airport
 * @param {string} icao - Airport ICAO code
 */
function getArrivals(icao) {
  const code = icao.toUpperCase();
  const pilots = getPilots().filter(p =>
    p.flight_plan?.arrival?.toUpperCase() === code
  );
  const prefiles = getPrefiles().filter(p =>
    p.flight_plan?.arrival?.toUpperCase() === code
  );
  return { pilots, prefiles };
}

/**
 * Get airports with active traffic
 */
function getActiveAirports() {
  const airports = new Map();

  for (const pilot of getPilots()) {
    const dep = pilot.flight_plan?.departure?.toUpperCase();
    const arr = pilot.flight_plan?.arrival?.toUpperCase();

    if (dep) {
      if (!airports.has(dep)) {
        airports.set(dep, { icao: dep, departures: 0, arrivals: 0 });
      }
      airports.get(dep).departures++;
    }

    if (arr) {
      if (!airports.has(arr)) {
        airports.set(arr, { icao: arr, departures: 0, arrivals: 0 });
      }
      airports.get(arr).arrivals++;
    }
  }

  // Also count prefiles
  for (const prefile of getPrefiles()) {
    const dep = prefile.flight_plan?.departure?.toUpperCase();
    const arr = prefile.flight_plan?.arrival?.toUpperCase();

    if (dep) {
      if (!airports.has(dep)) {
        airports.set(dep, { icao: dep, departures: 0, arrivals: 0 });
      }
      airports.get(dep).departures++;
    }

    if (arr) {
      if (!airports.has(arr)) {
        airports.set(arr, { icao: arr, departures: 0, arrivals: 0 });
      }
      airports.get(arr).arrivals++;
    }
  }

  return Array.from(airports.values())
    .sort((a, b) => (b.departures + b.arrivals) - (a.departures + a.arrivals));
}

/**
 * Get last update timestamp
 */
function getLastUpdate() {
  return lastFetch;
}

module.exports = {
  startPolling,
  stopPolling,
  getData,
  getPilots,
  getPrefiles,
  getDepartures,
  getArrivals,
  getActiveAirports,
  getLastUpdate
};
