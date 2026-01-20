// Load environment variables first
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');
const vatsimService = require('./services/vatsim');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');
const sitemapRoutes = require('./routes/sitemap');

const app = express();

// Trust proxy (for correct IP detection behind reverse proxy)
app.set('trust proxy', true, 1);

// Configuration from environment
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SSL_CERT = process.env.SSL_CERT;
const SSL_KEY = process.env.SSL_KEY;

// Security: Helmet for HTTP headers (allow embedding from any domain)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      frameAncestors: null // Remove frame-ancestors restriction to allow embedding
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  xFrameOptions: false // Disable X-Frame-Options to allow embedding in iframes
}));

// Security: Disable x-powered-by header
app.disable('x-powered-by');

// Security: Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Security: Stricter rate limiting for API
app.use('/api', apiLimiter);

// Security: General rate limiting for all routes (more lenient)
const generalLimiter = rateLimit({
  windowMs: 60000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(generalLimiter);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Static files with caching
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  etag: true
}));

// Routes
app.use('/api', apiRoutes);
app.use('/', sitemapRoutes);
app.use('/', pageRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Not Found',
    message: 'Page not found',
    layout: 'layouts/main'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    title: '500 - Server Error',
    message: 'Internal server error',
    layout: 'layouts/main'
  });
});

// Start VATSIM data polling
vatsimService.startPolling();

// Start server (HTTPS if certs provided, otherwise HTTP)
function startServer() {
  if (SSL_CERT && SSL_KEY) {
    try {
      const sslOptions = {
        cert: fs.readFileSync(SSL_CERT),
        key: fs.readFileSync(SSL_KEY)
      };

      https.createServer(sslOptions, app).listen(PORT, HOST, () => {
        console.log(`VATSIM Deparr running at https://${HOST}:${PORT}`);
      });
    } catch (error) {
      console.error('Failed to load SSL certificates:', error.message);
      console.log('Falling back to HTTP...');
      startHttpServer();
    }
  } else {
    startHttpServer();
  }
}

function startHttpServer() {
  http.createServer(app).listen(PORT, HOST, () => {
    console.log(`VATSIM Deparr running at http://${HOST}:${PORT}`);
  });
}

startServer();
