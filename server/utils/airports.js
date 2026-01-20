/**
 * Airport Data Utilities
 * Provides airport information (ICAO, IATA, name, coordinates)
 */

const fs = require('fs');
const path = require('path');

let airportsData = null;
let airportsMap = null;

/**
 * Load airports data from JSON file
 */
function loadAirports() {
  if (airportsData) return airportsData;

  try {
    const filePath = path.join(__dirname, '../../data/airports.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    airportsData = JSON.parse(raw);

    // Build lookup map
    airportsMap = new Map();
    for (const airport of airportsData) {
      airportsMap.set(airport.icao.toUpperCase(), airport);
      if (airport.iata) {
        airportsMap.set(airport.iata.toUpperCase(), airport);
      }
    }

    console.log(`Loaded ${airportsData.length} airports`);
  } catch (error) {
    console.error('Failed to load airports data:', error.message);
    airportsData = [];
    airportsMap = new Map();
  }

  return airportsData;
}

/**
 * Get airport by ICAO or IATA code
 */
function getAirport(code) {
  if (!airportsMap) loadAirports();
  return airportsMap.get(code?.toUpperCase()) || null;
}

/**
 * Get airport name
 */
function getAirportName(code) {
  const airport = getAirport(code);
  return airport?.name || code;
}

/**
 * Get all airports
 */
function getAllAirports() {
  if (!airportsData) loadAirports();
  return airportsData;
}

/**
 * Search airports by query (ICAO, IATA, or name)
 */
function searchAirports(query) {
  if (!airportsData) loadAirports();
  if (!query) return airportsData;

  const q = query.toUpperCase();
  return airportsData.filter(a =>
    a.icao.toUpperCase().includes(q) ||
    (a.iata && a.iata.toUpperCase().includes(q)) ||
    a.name.toUpperCase().includes(q) ||
    (a.city && a.city.toUpperCase().includes(q))
  );
}

// Load on module init
loadAirports();

module.exports = {
  getAirport,
  getAirportName,
  getAllAirports,
  searchAirports,
  loadAirports
};
