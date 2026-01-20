/**
 * API Routes
 */

const express = require('express');
const router = express.Router();
const vatsimService = require('../services/vatsim');
const flightStatus = require('../services/flightStatus');
const airportsData = require('../utils/airports');
const gatesData = require('../utils/gates');

/**
 * Validate ICAO code format (2-4 uppercase letters)
 */
function isValidIcao(icao) {
  return /^[A-Z]{2,4}$/.test(icao);
}

/**
 * Sanitize search query
 */
function sanitizeQuery(query) {
  if (!query || typeof query !== 'string') return '';
  // Remove any potentially harmful characters, keep only alphanumeric and spaces
  return query.replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 50);
}

/**
 * GET /api/airports
 * List all airports with optional search and traffic data
 */
router.get('/airports', (req, res) => {
  const q = sanitizeQuery(req.query.q);
  let airports = q
    ? airportsData.searchAirports(q)
    : airportsData.getAllAirports();

  // Add traffic counts
  const activeAirports = vatsimService.getActiveAirports();
  const trafficMap = new Map(activeAirports.map(a => [a.icao, a]));

  airports = airports.map(airport => ({
    ...airport,
    departures: trafficMap.get(airport.icao)?.departures || 0,
    arrivals: trafficMap.get(airport.icao)?.arrivals || 0
  }));

  // Sort by traffic if no search query
  if (!q) {
    airports.sort((a, b) =>
      (b.departures + b.arrivals) - (a.departures + a.arrivals)
    );
  }

  res.json(airports);
});

/**
 * GET /api/active-airports
 * List only airports with active traffic
 */
router.get('/active-airports', (req, res) => {
  const activeAirports = vatsimService.getActiveAirports();

  // Enrich with airport names
  const enriched = activeAirports.map(a => {
    const info = airportsData.getAirport(a.icao);
    return {
      ...a,
      name: info?.name || a.icao,
      iata: info?.iata || null,
      city: info?.city || null
    };
  });

  res.json(enriched);
});

/**
 * GET /api/airport/:icao
 * Get full data for an airport (departures + arrivals)
 */
router.get('/airport/:icao', (req, res) => {
  const icao = req.params.icao.toUpperCase();

  // Validate ICAO format
  if (!isValidIcao(icao)) {
    return res.status(400).json({ error: 'Invalid ICAO code format' });
  }

  const airport = airportsData.getAirport(icao);
  const departures = buildDepartureBoard(icao);
  const arrivals = buildArrivalBoard(icao);

  res.json({
    icao,
    name: airport?.name || icao,
    iata: airport?.iata || null,
    departures,
    arrivals,
    lastUpdate: vatsimService.getLastUpdate()
  });
});

/**
 * GET /api/departures/:icao
 * Get departures only
 */
router.get('/departures/:icao', (req, res) => {
  const icao = req.params.icao.toUpperCase();

  // Validate ICAO format
  if (!isValidIcao(icao)) {
    return res.status(400).json({ error: 'Invalid ICAO code format' });
  }

  const airport = airportsData.getAirport(icao);
  const departures = buildDepartureBoard(icao);

  res.json({
    icao,
    name: airport?.name || icao,
    departures,
    lastUpdate: vatsimService.getLastUpdate()
  });
});

/**
 * GET /api/arrivals/:icao
 * Get arrivals only
 */
router.get('/arrivals/:icao', (req, res) => {
  const icao = req.params.icao.toUpperCase();

  // Validate ICAO format
  if (!isValidIcao(icao)) {
    return res.status(400).json({ error: 'Invalid ICAO code format' });
  }

  const airport = airportsData.getAirport(icao);
  const arrivals = buildArrivalBoard(icao);

  res.json({
    icao,
    name: airport?.name || icao,
    arrivals,
    lastUpdate: vatsimService.getLastUpdate()
  });
});

/**
 * Build departure board data
 */
function buildDepartureBoard(icao) {
  const { pilots, prefiles } = vatsimService.getDepartures(icao);
  const board = [];

  // Add active pilots
  for (const pilot of pilots) {
    const status = flightStatus.getDepartureStatus(pilot, icao);
    const destInfo = airportsData.getAirport(pilot.flight_plan?.arrival);
    const scheduledDate = flightStatus.parseDepTime(pilot.flight_plan?.deptime);

    // Find gate for aircraft that are at the gate
    let gate = null;
    const atGateStatuses = ['GO TO GATE', 'BOARDING', 'GATE CLOSED'];
    if (atGateStatuses.includes(status.status) || status.status.startsWith('DELAYED')) {
      const nearestGate = gatesData.findNearestGate(
        icao,
        pilot.latitude,
        pilot.longitude,
        200 // 150m max distance for gate matching
      );
      if (nearestGate) {
        gate = nearestGate.ref;
      }
    }

    board.push({
      callsign: pilot.callsign,
      aircraft: pilot.flight_plan?.aircraft_short || 'N/A',
      destination: pilot.flight_plan?.arrival || 'N/A',
      destinationName: destInfo?.name || pilot.flight_plan?.arrival || 'N/A',
      scheduledTime: flightStatus.formatTime(pilot.flight_plan?.deptime),
      scheduledTimestamp: scheduledDate ? scheduledDate.getTime() : null,
      status: status.status,
      statusColor: status.color,
      sortOrder: status.sortOrder,
      isPrefile: false,
      gate: gate
    });
  }

  // Add prefiles (not yet connected)
  for (const prefile of prefiles) {
    // Skip if pilot is already connected with same callsign
    if (pilots.some(p => p.callsign === prefile.callsign)) continue;

    const status = flightStatus.getPrefileStatus(prefile);
    const destInfo = airportsData.getAirport(prefile.flight_plan?.arrival);
    const scheduledDate = flightStatus.parseDepTime(prefile.flight_plan?.deptime);

    board.push({
      callsign: prefile.callsign,
      aircraft: prefile.flight_plan?.aircraft_short || 'N/A',
      destination: prefile.flight_plan?.arrival || 'N/A',
      destinationName: destInfo?.name || prefile.flight_plan?.arrival || 'N/A',
      scheduledTime: flightStatus.formatTime(prefile.flight_plan?.deptime),
      scheduledTimestamp: scheduledDate ? scheduledDate.getTime() : null,
      status: status.status,
      statusColor: status.color,
      sortOrder: status.sortOrder,
      isPrefile: true,
      gate: null
    });
  }

  // Sort by scheduled timestamp (handles day boundary correctly), then by status
  board.sort((a, b) => {
    // First by timestamp (null values go to the end)
    if (a.scheduledTimestamp !== b.scheduledTimestamp) {
      if (a.scheduledTimestamp === null) return 1;
      if (b.scheduledTimestamp === null) return -1;
      return a.scheduledTimestamp - b.scheduledTimestamp;
    }
    // Then by status order
    return a.sortOrder - b.sortOrder;
  });

  return board;
}

/**
 * Build arrival board data
 */
function buildArrivalBoard(icao) {
  const { pilots, prefiles } = vatsimService.getArrivals(icao);
  const board = [];
  const currentPilots = vatsimService.getPilots();

  // Check for LOST flights
  const lostFlights = flightStatus.checkLostFlights(currentPilots);
  const lostToThisAirport = lostFlights.filter(f => f.arrival?.toUpperCase() === icao);

  // Add LOST flights
  for (const lost of lostToThisAirport) {
    const originInfo = airportsData.getAirport(lost.departure);
    board.push({
      callsign: lost.callsign,
      aircraft: 'N/A',
      origin: lost.departure || 'N/A',
      originName: originInfo?.name || lost.departure || 'N/A',
      scheduledTime: '--:--',
      eta: '--:--',
      etaTimestamp: null,
      status: 'LOST',
      statusColor: 'red',
      sortOrder: -2,
      isLost: true,
      gate: null
    });
  }

  // Add active pilots
  for (const pilot of pilots) {
    const status = flightStatus.getArrivalStatus(pilot, icao);
    const originInfo = airportsData.getAirport(pilot.flight_plan?.departure);
    const eta = flightStatus.calculateETA(pilot, icao);

    // Find gate for aircraft that are on the ground at the airport
    let gate = null;
    if (status.status === 'LANDED' || status.status === 'TAXIING') {
      const nearestGate = gatesData.findNearestGate(
        icao,
        pilot.latitude,
        pilot.longitude,
        200 // 200m max distance for gate matching
      );
      if (nearestGate) {
        gate = nearestGate.ref;
      }
    }

    board.push({
      callsign: pilot.callsign,
      aircraft: pilot.flight_plan?.aircraft_short || 'N/A',
      origin: pilot.flight_plan?.departure || 'N/A',
      originName: originInfo?.name || pilot.flight_plan?.departure || 'N/A',
      scheduledTime: flightStatus.formatTime(pilot.flight_plan?.deptime),
      eta: eta ? eta.toISOString().substring(11, 16) : '--:--',
      etaTimestamp: eta ? eta.getTime() : null,
      status: status.status,
      statusColor: status.color,
      sortOrder: status.sortOrder,
      isPrefile: false,
      gate: gate
    });
  }

  // Add prefiles that haven't departed (for CANCELED detection)
  for (const prefile of prefiles) {
    // Skip if pilot is already connected with same callsign
    if (pilots.some(p => p.callsign === prefile.callsign)) continue;

    const status = flightStatus.getPrefileStatus(prefile);
    const originInfo = airportsData.getAirport(prefile.flight_plan?.departure);

    // Only show CANCELED prefiles on arrival board
    if (status.status === 'CANCELED') {
      board.push({
        callsign: prefile.callsign,
        aircraft: prefile.flight_plan?.aircraft_short || 'N/A',
        origin: prefile.flight_plan?.departure || 'N/A',
        originName: originInfo?.name || prefile.flight_plan?.departure || 'N/A',
        scheduledTime: flightStatus.formatTime(prefile.flight_plan?.deptime),
        eta: '--:--',
        etaTimestamp: null,
        status: 'CANCELED',
        statusColor: 'red',
        sortOrder: -1,
        isPrefile: true,
        gate: null
      });
    }
  }

  // Sort: LOST/CANCELED first, then by ETA timestamp, then by status
  board.sort((a, b) => {
    // Special statuses first
    if (a.sortOrder < 0 || b.sortOrder < 0) {
      return a.sortOrder - b.sortOrder;
    }
    // Then by ETA timestamp (handles day boundary correctly)
    if (a.etaTimestamp !== b.etaTimestamp) {
      if (a.etaTimestamp === null) return 1;
      if (b.etaTimestamp === null) return -1;
      return a.etaTimestamp - b.etaTimestamp;
    }
    // Then by status order (closer to landing = higher)
    return b.sortOrder - a.sortOrder;
  });

  return board;
}

module.exports = router;
