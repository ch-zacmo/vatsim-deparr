# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-20

### Added

- Gate information display on departure/arrival boards
- Gate column in flight tables view
- Aircraft gate determination based on position and airport data
- Script to populate gates information from Overpass API
- Script for updating airports database from ip2location repository
- IP2Location IATA-ICAO repository integration as database source
- Favicon for the application
- SEO meta tags

### Fixed

- Trust proxy configuration for hosted deployments
- Maximum distance threshold for gate finding accuracy
- Flight order handling for correct display sequence

### Changed

- Updated airport database with latest data
- Updated dependencies

## [1.0.0] - 2026-01-20

### Added

- Initial release
- Real-time FIDS (Flight Information Display System) for VATSIM
- Departure and arrival boards with live flight status
- Airport search functionality
- Active airports listing
- Embeddable display pages
- REST API for flight data
- Flight status calculation (boarding, taxiing, departed, etc.)
