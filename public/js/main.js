/**
 * VATSIM Deparr - Client-side JavaScript
 */

const REFRESH_INTERVAL = 15000; // 15 seconds

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Time mode: 'utc' or 'local'
let timeMode = 'utc';

// Initialize clock
function updateClock() {
  const clockEl = document.getElementById('clock');
  if (clockEl) {
    const now = new Date();
    let timeStr;

    if (timeMode === 'utc') {
      timeStr = now.toISOString().substring(11, 19) + ' UTC';
    } else {
      timeStr = now.toLocaleTimeString('en-GB', { hour12: false }) + ' Local';
    }

    clockEl.textContent = timeStr;
  }
}

// Initialize time toggle
function initTimeToggle() {
  const toggle = document.getElementById('timeToggle');
  const label = document.getElementById('timeLabel');

  if (toggle && label) {
    // Load saved preference
    const saved = localStorage.getItem('timeMode');
    if (saved === 'local') {
      timeMode = 'local';
      toggle.checked = true;
      label.textContent = 'Local';
    }

    toggle.addEventListener('change', () => {
      if (toggle.checked) {
        timeMode = 'local';
        label.textContent = 'Local';
      } else {
        timeMode = 'utc';
        label.textContent = 'UTC';
      }
      localStorage.setItem('timeMode', timeMode);
      updateClock();
    });
  }
}

setInterval(updateClock, 1000);
updateClock();

// Page-specific initialization
document.addEventListener('DOMContentLoaded', () => {
  const pageType = window.PAGE_TYPE;

  // Initialize time toggle on all pages
  initTimeToggle();

  if (pageType === 'index') {
    initAirportSelector();
  } else if (pageType === 'airport') {
    initAirportDisplay();
  } else if (pageType === 'departures') {
    initDeparturesOnly();
  } else if (pageType === 'arrivals') {
    initArrivalsOnly();
  }
});

/**
 * Airport Selector Page
 */
function initAirportSelector() {
  const searchInput = document.getElementById('airportSearch');
  const listContainer = document.getElementById('airportList');

  let allAirports = [];
  let debounceTimer = null;

  // Load initial airport list
  loadAirports();

  // Event delegation for airport item clicks
  listContainer.addEventListener('click', (e) => {
    const airportItem = e.target.closest('.airport-item');
    if (airportItem && airportItem.dataset.icao) {
      location.href = '/airport/' + airportItem.dataset.icao;
    }
  });

  // Search input handler
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query.length >= 2) {
        loadAirports(query);
      } else if (query.length === 0) {
        loadAirports();
      }
    }, 300);
  });

  async function loadAirports(query = '') {
    try {
      const url = query
        ? `/api/airports?q=${encodeURIComponent(query)}`
        : '/api/active-airports';

      const response = await fetch(url);
      const airports = await response.json();

      renderAirportList(airports, query);
    } catch (error) {
      console.error('Failed to load airports:', error);
      listContainer.innerHTML = '<div class="loading">Failed to load airports</div>';
    }
  }

  function renderAirportList(airports, isSearch) {
    if (airports.length === 0) {
      listContainer.innerHTML = '<div class="no-flights">No airports found</div>';
      return;
    }

    // Limit to first 100 if showing all
    const displayAirports = airports.slice(0, 100);

    listContainer.innerHTML = displayAirports.map(airport => {
      const hasTraffic = airport.departures > 0 || airport.arrivals > 0;
      const icao = escapeHtml(airport.icao);
      const iata = escapeHtml(airport.iata);
      const name = escapeHtml(airport.name);

      return `
        <div class="airport-item" data-icao="${icao}">
          <div class="airport-item-main">
            <span class="airport-item-icao">${icao}</span>
            ${airport.iata ? `<span class="airport-item-iata">${iata}</span>` : ''}
            <span class="airport-item-name">${name}</span>
          </div>
          <div class="airport-item-traffic">
            ${hasTraffic ? `
              <span class="traffic-dep">DEP: ${airport.departures || 0}</span>
              <span class="traffic-arr">ARR: ${airport.arrivals || 0}</span>
            ` : '<span class="no-traffic">No traffic</span>'}
          </div>
        </div>
      `;
    }).join('');
  }

  // Refresh active airports periodically
  setInterval(() => {
    if (!searchInput.value.trim()) {
      loadAirports();
    }
  }, REFRESH_INTERVAL);
}

/**
 * Airport Display Page (both departures and arrivals)
 */
function initAirportDisplay() {
  const icao = window.AIRPORT_ICAO;

  loadAirportData(icao);
  setInterval(() => loadAirportData(icao), REFRESH_INTERVAL);
}

async function loadAirportData(icao) {
  try {
    const response = await fetch(`/api/airport/${icao}`);
    const data = await response.json();

    renderDepartures(data.departures);
    renderArrivals(data.arrivals);
    updateTimestamps(data.lastUpdate);
  } catch (error) {
    console.error('Failed to load airport data:', error);
  }
}

/**
 * Departures Only Page
 */
function initDeparturesOnly() {
  const icao = window.AIRPORT_ICAO;

  loadDepartures(icao);
  setInterval(() => loadDepartures(icao), REFRESH_INTERVAL);
}

async function loadDepartures(icao) {
  try {
    const response = await fetch(`/api/departures/${icao}`);
    const data = await response.json();

    renderDepartures(data.departures);
    updateTimestamps(data.lastUpdate, 'dep');
  } catch (error) {
    console.error('Failed to load departures:', error);
  }
}

/**
 * Arrivals Only Page
 */
function initArrivalsOnly() {
  const icao = window.AIRPORT_ICAO;

  loadArrivals(icao);
  setInterval(() => loadArrivals(icao), REFRESH_INTERVAL);
}

async function loadArrivals(icao) {
  try {
    const response = await fetch(`/api/arrivals/${icao}`);
    const data = await response.json();

    renderArrivals(data.arrivals);
    updateTimestamps(data.lastUpdate, 'arr');
  } catch (error) {
    console.error('Failed to load arrivals:', error);
  }
}

/**
 * Render Departures Table
 */
function renderDepartures(departures) {
  const tbody = document.getElementById('departuresBody');
  if (!tbody) return;

  if (!departures || departures.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-flights">No departures</td></tr>';
    return;
  }

  tbody.innerHTML = departures.map(flight => `
    <tr>
      <td>${escapeHtml(flight.scheduledTime)}</td>
      <td class="callsign">${escapeHtml(flight.callsign)}</td>
      <td title="${escapeHtml(flight.destinationName)}">${escapeHtml(flight.destination)}</td>
      <td>${escapeHtml(flight.aircraft)}</td>
      <td class="gate">${escapeHtml(flight.gate || '-')}</td>
      <td class="status-${escapeHtml(flight.statusColor)}">${escapeHtml(flight.status)}</td>
    </tr>
  `).join('');
}

/**
 * Render Arrivals Table
 */
function renderArrivals(arrivals) {
  const tbody = document.getElementById('arrivalsBody');
  if (!tbody) return;

  if (!arrivals || arrivals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-flights">No arrivals</td></tr>';
    return;
  }

  tbody.innerHTML = arrivals.map(flight => `
    <tr>
      <td>${escapeHtml(flight.eta || flight.scheduledTime)}</td>
      <td class="callsign">${escapeHtml(flight.callsign)}</td>
      <td title="${escapeHtml(flight.originName)}">${escapeHtml(flight.origin)}</td>
      <td>${escapeHtml(flight.aircraft)}</td>
      <td class="gate">${escapeHtml(flight.gate || '-')}</td>
      <td class="status-${escapeHtml(flight.statusColor)}">${escapeHtml(flight.status)}</td>
    </tr>
  `).join('');
}

/**
 * Update timestamp displays
 */
function updateTimestamps(timestamp, type = 'both') {
  const time = timestamp ? new Date(timestamp).toISOString().substring(11, 19) : '--:--:--';

  if (type === 'both' || type === 'dep') {
    const depEl = document.getElementById('depUpdateTime');
    if (depEl) depEl.textContent = `Updated: ${time} UTC`;
  }

  if (type === 'both' || type === 'arr') {
    const arrEl = document.getElementById('arrUpdateTime');
    if (arrEl) arrEl.textContent = `Updated: ${time} UTC`;
  }
}
