/**
 * Sitemap Routes
 */

const express = require('express');
const router = express.Router();
const vatsimService = require('../services/vatsim');

/**
 * GET /sitemap.xml
 * Dynamic XML sitemap
 */
router.get('/sitemap.xml', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const now = new Date().toISOString().split('T')[0];

  // Static pages
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/info', priority: '0.5', changefreq: 'monthly' }
  ];

  // Get active airports with traffic
  const activeAirports = vatsimService.getActiveAirports();

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Add static pages
  for (const page of staticPages) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.loc}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // Add active airport pages
  for (const airport of activeAirports) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/airport/${airport.icao}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>always</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

/**
 * GET /robots.txt
 * Robots file with sitemap reference
 */
router.get('/robots.txt', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /embed/
Disallow: /departures/
Disallow: /arrivals/

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.set('Content-Type', 'text/plain');
  res.send(robots);
});

module.exports = router;
