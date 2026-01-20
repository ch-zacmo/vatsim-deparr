/**
 * Flight Status Calculation Service
 * Determines flight phase and status for departure/arrival boards
 */

const airportsData = require('../utils/airports');

// Track pilots for LOST detection
const trackedPilots = new Map(); // callsign -> { lastSeen, wasAirborne, departure, arrival }

/**
 * Calculate distance between two coordinates in nautical miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if aircraft is on the ground
 */
function isOnGround(pilot) {
  return pilot.groundspeed < 50 && pilot.altitude < 1500;
}

/**
 * Check if aircraft is airborne
 */
function isAirborne(pilot) {
  return pilot.groundspeed > 80 || pilot.altitude > 2000;
}

/**
 * Get distance from airport
 */
function getDistanceFromAirport(pilot, icao) {
  const airport = airportsData.getAirport(icao);
  if (!airport) return null;
  return calculateDistance(pilot.latitude, pilot.longitude, airport.lat, airport.lon);
}

/**
 * Calculate departure status for a pilot
 */
function getDepartureStatus(pilot, airportIcao) {
  const distance = getDistanceFromAirport(pilot, airportIcao);
  const onGround = isOnGround(pilot);
  const airborne = isAirborne(pilot);

  // Update tracking
  trackPilot(pilot);

  // Parse scheduled departure time
  const scheduledDep = parseDepTime(pilot.flight_plan?.deptime);
  const now = new Date();

  if (airborne) {
    if (distance !== null && distance < 50) {
      return { status: 'DEPARTED', color: 'green', sortOrder: 5 };
    }
    return { status: 'EN ROUTE', color: 'green', sortOrder: 6 };
  }

  if (onGround && distance !== null && distance < 5) {
    // Pilot is at the departure airport
    if (scheduledDep && now > scheduledDep) {
      const delayMins = Math.floor((now - scheduledDep) / 60000);
      return { status: `DELAYED ${delayMins}min`, color: 'red', sortOrder: 2 };
    }

    if (pilot.groundspeed >= 5) {
      return { status: 'TAXIING', color: 'yellow', sortOrder: 3 };
    }

    // Check time until departure
    if (scheduledDep) {
      const minsUntilDep = Math.floor((scheduledDep - now) / 60000);
      if (minsUntilDep <= 10 && minsUntilDep > 0) {
        return { status: 'GATE CLOSED', color: 'yellow', sortOrder: 3 };
      }
      if (minsUntilDep <= 30 && minsUntilDep > 10) {
        return { status: 'BOARDING', color: 'white', sortOrder: 2 };
      }
    }

    return { status: 'GO TO GATE', color: 'white', sortOrder: 1 };
  }

  // Pilot is NOT at the departure airport (on ground elsewhere or unknown location)
  if (scheduledDep) {
    const delayMins = Math.floor((now - scheduledDep) / 60000);
    if (delayMins > 60) {
      // More than 1 hour past scheduled time and not at airport = No Show
      return { status: 'NO SHOW', color: 'red', sortOrder: -1 };
    }
    if (delayMins > 0) {
      // Past scheduled time but less than 1 hour
      return { status: `DELAYED ${delayMins}min`, color: 'red', sortOrder: 2 };
    }
  }

  // Flight plan filed but pilot not yet at departure airport
  return { status: 'EXPECTED', color: 'white', sortOrder: 0 };
}

/**
 * Calculate arrival status for a pilot
 */
function getArrivalStatus(pilot, airportIcao) {
  const distance = getDistanceFromAirport(pilot, airportIcao);
  const depDistance = getDistanceFromAirport(pilot, pilot.flight_plan?.departure);
  const onGround = isOnGround(pilot);
  const airborne = isAirborne(pilot);

  // Update tracking
  trackPilot(pilot);

  if (onGround && distance !== null && distance < 5) {
    if (pilot.groundspeed >= 5) {
      return { status: 'TAXIING', color: 'yellow', sortOrder: 5 };
    }
    return { status: 'LANDED', color: 'green', sortOrder: 6 };
  }

  if (airborne) {
    if (distance !== null) {
      if (distance < 10) {
        return { status: 'LANDING', color: 'yellow', sortOrder: 4 };
      }
      if (distance < 50) {
        return { status: 'APPROACHING', color: 'white', sortOrder: 3 };
      }
      if (distance < 150) {
        return { status: 'ARRIVING', color: 'white', sortOrder: 2 };
      }
    }
    return { status: 'EN ROUTE', color: 'white', sortOrder: 1 };
  }

  // On ground, not at arrival airport
  // Check if pilot is at departure airport (hasn't departed yet)
  if (onGround && depDistance !== null && depDistance < 5) {
    return { status: 'AT ORIGIN', color: 'white', sortOrder: 0 };
  }

  // On ground somewhere else (diverted or unknown)
  return { status: 'ON GROUND', color: 'yellow', sortOrder: 0 };
}

/**
 * Get status for a prefile (departure board)
 */
function getPrefileStatus(prefile) {
  const scheduledDep = parseDepTime(prefile.flight_plan?.deptime);
  const now = new Date();

  if (scheduledDep && now > scheduledDep) {
    const delayMins = Math.floor((now - scheduledDep) / 60000);
    if (delayMins > 60) {
      return { status: 'CANCELED', color: 'red', sortOrder: -1 };
    }
    return { status: `DELAYED ${delayMins}min`, color: 'red', sortOrder: 2 };
  }

  return { status: 'GO TO GATE', color: 'white', sortOrder: 1 };
}

/**
 * Parse VATSIM departure time (HHMM format)
 * Handles day boundary by assuming flights are scheduled within ±12 hours of now
 */
function parseDepTime(deptime) {
  if (!deptime || deptime.length < 4) return null;

  const now = new Date();
  const hours = parseInt(deptime.substring(0, 2), 10);
  const minutes = parseInt(deptime.substring(2, 4), 10);

  if (isNaN(hours) || isNaN(minutes)) return null;

  const scheduled = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hours,
    minutes
  ));

  const diffMs = scheduled - now;
  const twelveHoursMs = 12 * 60 * 60 * 1000;

  // If scheduled time is more than 12 hours in the future, assume it was yesterday
  if (diffMs > twelveHoursMs) {
    scheduled.setUTCDate(scheduled.getUTCDate() - 1);
  }
  // If scheduled time is more than 12 hours in the past, assume it's for tomorrow
  else if (diffMs < -twelveHoursMs) {
    scheduled.setUTCDate(scheduled.getUTCDate() + 1);
  }

  return scheduled;
}

/**
 * Track a pilot for LOST detection
 */
function trackPilot(pilot) {
  const data = {
    lastSeen: Date.now(),
    wasAirborne: isAirborne(pilot),
    departure: pilot.flight_plan?.departure,
    arrival: pilot.flight_plan?.arrival,
    altitude: pilot.altitude,
    position: { lat: pilot.latitude, lon: pilot.longitude }
  };
  trackedPilots.set(pilot.callsign, data);
}

/**
 * Check for LOST flights (pilots who disconnected mid-flight)
 */
function checkLostFlights(currentPilots) {
  const currentCallsigns = new Set(currentPilots.map(p => p.callsign));
  const lostFlights = [];
  const now = Date.now();

  for (const [callsign, data] of trackedPilots) {
    // If pilot was seen recently but is now gone
    if (!currentCallsigns.has(callsign)) {
      const timeSinceSeen = now - data.lastSeen;

      // If they were airborne and disappeared within the last 2 minutes
      if (data.wasAirborne && timeSinceSeen < 120000) {
        lostFlights.push({
          callsign,
          departure: data.departure,
          arrival: data.arrival,
          lastPosition: data.position,
          lastAltitude: data.altitude
        });
      }

      // Clean up old entries (older than 5 minutes)
      if (timeSinceSeen > 300000) {
        trackedPilots.delete(callsign);
      }
    }
  }

  return lostFlights;
}

/**
 * Format time for display (HH:MM)
 */
function formatTime(deptime) {
  if (!deptime || deptime.length < 4) return '--:--';
  return `${deptime.substring(0, 2)}:${deptime.substring(2, 4)}`;
}

/**
 * Extract airline code from callsign
 */
function getAirlineCode(callsign) {
  // Most callsigns start with 3-letter airline code
  const match = callsign.match(/^([A-Z]{3})/);
  return match ? match[1] : null;
}

/**
 * Calculate estimated arrival time
 */
function calculateETA(pilot, arrivalIcao) {
  const distance = getDistanceFromAirport(pilot, arrivalIcao);
  if (!distance || pilot.groundspeed < 50) return null;

  const hoursToGo = distance / pilot.groundspeed;
  const eta = new Date(Date.now() + hoursToGo * 3600000);
  return eta;
}

module.exports = {
  getDepartureStatus,
  getArrivalStatus,
  getPrefileStatus,
  checkLostFlights,
  formatTime,
  parseDepTime,
  getAirlineCode,
  calculateETA,
  getDistanceFromAirport,
  isOnGround,
  isAirborne
};
