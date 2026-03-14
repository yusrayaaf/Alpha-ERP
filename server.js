// server.js — Alpha Ultimate ERP v13
// Express server for IONOS / Termux / VPS deployment
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security + CORS headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// All /api/* -> unified serverless handler
app.all('/api/*', (req, res) => {
  req.query.r = req.path.replace(/^\/api\/?/, '');
  return handler(req, res);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: "13.0.0",
    time: new Date().toISOString(),
    env: NODE_ENV,
    db: process.env.DATABASE_URL ? 'configured' : 'MISSING',
    storage: process.env.CF_ACCOUNT_ID ? 'cloudflare-r2'
           : process.env.IMGBB_API_KEY ? 'imgbb'
           : 'none',
  });
});

// Serve built React frontend
const dist = path.join(__dirname, 'dist');
app.use(express.static(dist, { maxAge: '7d', etag: true }));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err && !res.headersSent) {
      res.status(503).send(
        '<html><body style="font-family:sans-serif;padding:2rem">' +
        '<h2>Alpha ERP — Build required</h2>' +
        '<p>Run <code>npm run build</code> then restart the server.</p>' +
        '</body></html>'
      );
    }
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     Alpha Ultimate ERP v13  🚀            ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('   Port    : ' + PORT);
  console.log('   Mode    : ' + NODE_ENV);
  console.log('   DB      : ' + (process.env.DATABASE_URL ? '✓ configured' : '✗ DATABASE_URL missing!'));
  console.log('   JWT     : ' + (process.env.JWT_SECRET ? '✓ set' : '⚠  using fallback'));
  console.log('   Storage : ' + (process.env.CF_ACCOUNT_ID ? '✓ Cloudflare R2' : process.env.IMGBB_API_KEY ? '✓ ImgBB' : '⚠  none'));
  console.log('   URL     : http://localhost:' + PORT);
  console.log('');
  console.log('   Default login: admin / Admin@12345');
  console.log('');
});
