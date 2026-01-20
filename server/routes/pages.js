/**
 * Page Routes
 */

const express = require('express');
const router = express.Router();
const airportsData = require('../utils/airports');

/**
 * Validate ICAO code format (2-4 uppercase letters)
 */
function isValidIcao(icao) {
  return /^[A-Z]{2,4}$/.test(icao);
}

/**
 * Build canonical URL from request
 */
function getCanonicalUrl(req, path = '') {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${path || req.originalUrl}`;
}

/**
 * GET /
 * Main page - Airport selector
 */
router.get('/', (req, res) => {
  res.render('index', {
    title: 'VATSIM Departures & Arrivals',
    description: 'Browse and select airports to view real-time departure and arrival boards from the VATSIM flight simulation network.',
    canonical: getCanonicalUrl(req, '/')
  });
});

/**
 * GET /info
 * Information page about flight statuses
 */
router.get('/info', (req, res) => {
  res.render('info', {
    title: 'Flight Status Information - VATSIM Deparr',
    description: 'Learn how flight statuses are calculated for VATSIM virtual flights. Understand departure and arrival status meanings, ETA calculations, and data sources.',
    canonical: getCanonicalUrl(req)
  });
});

/**
 * GET /airport/:icao
 * Airport departure/arrival display
 */
router.get('/airport/:icao', (req, res) => {
  const icao = req.params.icao.toUpperCase();

  // Validate ICAO format
  if (!isValidIcao(icao)) {
    return res.status(400).render('error', {
      title: '400 - Bad Request',
      message: 'Invalid ICAO code format',
      layout: 'layouts/main'
    });
  }

  const airport = airportsData.getAirport(icao);
  const airportName = airport?.name || icao;

  res.render('airport', {
    title: `${airportName} - VATSIM Deparr`,
    description: `Live departures and arrivals for ${airportName} (${icao}) on the VATSIM network. Track virtual flights in real-time.`,
    canonical: getCanonicalUrl(req),
    icao,
    airportName,
    iata: airport?.iata || null
  });
});

/**
 * GET /departures/:icao
 * Standalone departures view (for embedding)
 */
router.get('/departures/:icao', (req, res) => {
  const icao = req.params.icao.toUpperCase();

  // Validate ICAO format
  if (!isValidIcao(icao)) {
    return res.status(400).render('error', {
      title: '400 - Bad Request',
      message: 'Invalid ICAO code format',
      layout: 'layouts/main'
    });
  }

  const airport = airportsData.getAirport(icao);

  res.render('departures', {
    title: `Departures - ${airport?.name || icao}`,
    icao,
    airportName: airport?.name || icao,
    layout: 'layouts/embed'
  });
});

/**
 * GET /arrivals/:icao
 * Standalone arrivals view (for embedding)
 */
router.get('/arrivals/:icao', (req, res) => {
  const icao = req.params.icao.toUpperCase();

  // Validate ICAO format
  if (!isValidIcao(icao)) {
    return res.status(400).render('error', {
      title: '400 - Bad Request',
      message: 'Invalid ICAO code format',
      layout: 'layouts/main'
    });
  }

  const airport = airportsData.getAirport(icao);

  res.render('arrivals', {
    title: `Arrivals - ${airport?.name || icao}`,
    icao,
    airportName: airport?.name || icao,
    layout: 'layouts/embed'
  });
});

/**
 * GET /embed/:icao
 * Both departures and arrivals for embedding
 */
router.get('/embed/:icao', (req, res) => {
  const icao = req.params.icao.toUpperCase();

  // Validate ICAO format
  if (!isValidIcao(icao)) {
    return res.status(400).render('error', {
      title: '400 - Bad Request',
      message: 'Invalid ICAO code format',
      layout: 'layouts/main'
    });
  }

  const airport = airportsData.getAirport(icao);

  res.render('embed-both', {
    title: `${airport?.name || icao} - VATSIM Deparr`,
    icao,
    airportName: airport?.name || icao,
    layout: 'layouts/embed'
  });
});

module.exports = router;
