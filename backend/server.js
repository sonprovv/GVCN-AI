'use strict';
try {
  if (typeof process.loadEnvFile === 'function') process.loadEnvFile();
  else {
    const fs = require('node:fs');
    if (fs.existsSync('.env')) {
      for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
        const [k, ...v] = line.trim().split('=');
        if (k && !k.startsWith('#') && !process.env[k]) process.env[k] = v.join('=').trim();
      }
    }
  }
} catch {}
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { routeApi } = require('./routes/api');
const storage = require('./storage');
require('./auth'); // enforce production authentication configuration before starting

const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let cachedBundle = null;
async function getBundle() {
  if (cachedBundle) return cachedBundle;
  const parts = [0, 1, 2, 3].map(i => path.resolve(FRONTEND_DIR, `assets/bundle.part${i}.js`));
  const buffers = await Promise.all(parts.map(p => fs.readFile(p)));
  cachedBundle = Buffer.concat(buffers);
  return cachedBundle;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await routeApi(req, res, url);
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('Method Not Allowed'); }

    if (url.pathname === '/assets/index-SiniHO1L.js') {
      const bundle = await getBundle();
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': bundle.length,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=86400'
      });
      if (req.method === 'HEAD') return res.end();
      return res.end(bundle);
    }

    let pathname;
    try { pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
    catch { res.writeHead(400); return res.end('Invalid path'); }
    const target = path.resolve(FRONTEND_DIR, `.${pathname}`);
    if (!target.startsWith(FRONTEND_DIR + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    const stat = await fs.stat(target).catch(() => null);
    if (!stat || !stat.isFile()) { res.writeHead(404); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    res.end(await fs.readFile(target));
  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) res.writeHead(500);
    res.end('Internal Server Error');
  }
});
const port = Number(process.env.SERVER_PORT || process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

let dbReady = false;
let dbError = null;

function scheduleRetry(delay = 30000) {
  setTimeout(async () => {
    try {
      await storage.initializeStorage();
      dbReady = true; dbError = null;
      console.log(`[server] PostgreSQL connected on retry · ${storage.mode}`);
    } catch (e) {
      dbError = e.message;
      console.error('[server] DB retry failed:', e.message);
      scheduleRetry();
    }
  }, delay);
}

function start() {
  const shutdown = () => server.close(() => storage.shutdown().finally(() => process.exit(0)));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  storage.initializeStorage()
    .then(() => {
      dbReady = true; dbError = null;
      server.listen(port, host, () => console.log(`GVCN 360 listening on ${host}:${port} · ${storage.mode}`));
    })
    .catch(error => {
      dbError = error.message;
      console.error('Storage initialization failed:', error.message);
      console.log('[server] Starting in DEGRADED mode — no DB. Retrying every 30s...');
      scheduleRetry();
      server.listen(port, host, () => console.log(`GVCN 360 listening on ${host}:${port} · DEGRADED`));
    });
}
if (require.main === module) {
  start();
}
module.exports = { server, start };
