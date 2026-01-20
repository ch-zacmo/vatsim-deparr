/**
 * Airport Gates Utility
 * Handles loading gates database and finding nearest gate to aircraft position
 */

const fs = require('fs');
const path = require('path');

const GATES_FILE = path.join(__dirname, '../../data/gates.json');

// In-memory gates database
let gatesDb = {};

/**
 * Load gates database from file
 */
function loadGates() {
  try {
    if (fs.existsSync(GATES_FILE)) {
      const data = fs.readFileSync(GATES_FILE, 'utf8');
      gatesDb = JSON.parse(data);
      console.log(`Loaded gates for ${Object.keys(gatesDb).length} airports`);
    } else {
      console.log('Gates database not found. Run: node scripts/fetch-gates.js');
      gatesDb = {};
    }
  } catch (error) {
    console.error('Error loading gates database:', error.message);
    gatesDb = {};
  }
}

/**
 * Calculate distance between two coordinates in meters
 * Using Haversine formula for accuracy at small distances
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get all gates for an airport
 * @param {string} icao - Airport ICAO code
 * @returns {Array} Array of gate objects or empty array
 */
function getGates(icao) {
  const airportData = gatesDb[icao?.toUpperCase()];
  return airportData?.gates || [];
}

/**
 * Check if an airport has gates data
 * @param {string} icao - Airport ICAO code
 * @returns {boolean}
 */
function hasGates(icao) {
  const gates = getGates(icao);
  return gates.length > 0;
}

/**
 * Find the nearest gate to a given position
 * @param {string} icao - Airport ICAO code
 * @param {number} lat - Aircraft latitude
 * @param {number} lon - Aircraft longitude
 * @param {number} maxDistance - Maximum distance in meters (default 100m)
 * @returns {Object|null} Nearest gate object with distance, or null if none found
 */
function findNearestGate(icao, lat, lon, maxDistance = 100) {
  const gates = getGates(icao);

  if (gates.length === 0) {
    return null;
  }

  let nearest = null;
  let minDistance = Infinity;

  for (const gate of gates) {
    const distance = calculateDistanceMeters(lat, lon, gate.lat, gate.lon);

    if (distance < minDistance && distance <= maxDistance) {
      minDistance = distance;
      nearest = {
        ref: gate.ref,
        terminal: gate.terminal,
        distance: Math.round(distance)
      };
    }
  }

  return nearest;
}

/**
 * Get gate statistics for an airport
 * @param {string} icao - Airport ICAO code
 * @returns {Object} Statistics about gates
 */
function getGateStats(icao) {
  const gates = getGates(icao);

  if (gates.length === 0) {
    return { total: 0, gates: 0, parkingPositions: 0 };
  }

  const gateCount = gates.filter(g => g.type === 'gate').length;
  const parkingCount = gates.filter(g => g.type === 'parking_position').length;

  return {
    total: gates.length,
    gates: gateCount,
    parkingPositions: parkingCount
  };
}

// Load gates on module import
loadGates();

module.exports = {
  loadGates,
  getGates,
  hasGates,
  findNearestGate,
  getGateStats,
  calculateDistanceMeters
};
