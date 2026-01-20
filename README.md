# VATSIM Deparr

A web application that displays simulated airport departure and arrival screens using real-time VATSIM flight simulation network data.

**Note: This displays simulated flight data from VATSIM, not real-world flights.**

## Features

- **Airport Selection**: Search airports by ICAO, IATA code, or name
- **Departure Board**: Shows flight status progression (Expected, Go to Gate, Boarding, Departed, etc.)
- **Arrival Board**: Shows incoming flights with ETA, status, and special indicators (Canceled, Lost)
- **Embeddable Views**: Standalone departure, arrival, or combined views for embedding in external websites
- **Real-time Updates**: Auto-refreshes every 15 seconds with live VATSIM data
- **Classic FIDS Styling**: Authentic airport display aesthetic with dark theme and LED-style text

## Tech Stack

- **Backend**: Node.js + Express
- **Templating**: EJS with express-ejs-layouts
- **Frontend**: Vanilla JavaScript, Bootstrap 5
- **Bundler**: Webpack
- **Security**: Helmet.js, express-rate-limit
- **Data Source**: [VATSIM Public API](https://data.vatsim.net/v3/vatsim-data.json)

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/vatsim-deparr.git
cd vatsim-deparr

# Install dependencies
npm install

# Copy environment file and configure (optional)
cp .env.example .env

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

## Usage

### Web Interface

1. Open the main page and search for an airport
2. Click an airport to view its departure and arrival boards
3. Use the embed buttons in the top menu to get embeddable URLs

### Embedding

Embed departure/arrival screens on your website:

```html
<!-- Departures only -->
<iframe src="https://your-domain/departures/EGLL" width="100%" height="600"></iframe>

<!-- Arrivals only -->
<iframe src="https://your-domain/arrivals/EGLL" width="100%" height="600"></iframe>

<!-- Both boards -->
<iframe src="https://your-domain/embed/EGLL" width="100%" height="800"></iframe>
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `SSL_CERT` | - | Path to SSL certificate (optional) |
| `SSL_KEY` | - | Path to SSL private key (optional) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max API requests per minute |
| `VATSIM_POLL_INTERVAL` | 15000 | VATSIM API poll interval (ms) |

## Development

```bash
# Start with auto-reload
npm run dev

# Build JavaScript bundle
npm run build

# Build in watch mode
npm run build:dev
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run and test the application locally
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Guidelines

- Keep code simple and readable
- Follow existing code style
- Test changes with various airports (busy and quiet)
- Update documentation if needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Zacharie Monnet

## Acknowledgments

- [VATSIM](https://vatsim.net/) for providing the flight simulation network and public API
- [vatsim-radar](https://github.com/vatsim-radar/vatsim-radar) for API usage patterns reference
