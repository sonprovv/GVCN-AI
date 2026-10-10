'use strict';
// Document-style storage in PostgreSQL: retain the old JSON payloads in durable JSONB rows.
const fs = require('node:fs/promises');
const path = require('node:path');
const { ALLOWED } = require('./schema');

let pool;
let initialized;

function getGatewayIp() {
  try {
    const fsSync = require('node:fs');
    if (!fsSync.existsSync('/proc/net/route')) return null;
    const content = fsSync.readFileSync('/proc/net/route', 'utf8');
    for (const line of content.split('\n')) {
      const parts = line.trim().split('\t');
      if (parts[1] === '00000000') {
        const hex = parts[2];
        const bytes = [
          parseInt(hex.slice(6, 8), 16),
          parseInt(hex.slice(4, 6), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(0, 2), 16),
        ];
        return bytes.join('.');
      }
    }
  } catch {}
  return null;
}

// TCP-scan a subnet to find which host has the DB port open.
// Returns list of IPs with the port open, sorted by .x value.
function scanSubnetForPort(subnet3, port, timeoutMs = 500) {
  const net = require('node:net');
  const candidates = [];
  for (let i = 1; i <= 254; i++) candidates.push(`${subnet3}.${i}`);
  const CONCURRENCY = 60;
  return new Promise(resolve => {
    const found = [];
    let idx = 0;
    let active = 0;
    let done = false;
    function tryNext() {
      if (done) return;
      if (idx >= candidates.length && active === 0) { done = true; return resolve(found); }
      while (active < CONCURRENCY && idx < candidates.length) {
        const ip = candidates[idx++];
        active++;
        const sock = new net.Socket();
        let finished = false;
        const finish = (ok) => {
          if (finished) return;
          finished = true;
          active--;
          if (ok) found.push(ip);
          tryNext();
        };
        sock.setTimeout(timeoutMs);
        sock.connect(port, ip, () => { sock.destroy(); finish(true); });
        sock.on('error', () => finish(false));
        sock.on('timeout', () => { sock.destroy(); finish(false); });
      }
    }
    tryNext();
  });
}

const BOTKEEP_DEFAULT_CA = `-----BEGIN CERTIFICATE-----
MIIC6zCCAdOgAwIBAgIURhsNPmQpnZQgCj+DkdLniMdUd04wDQYJKoZIhvcNAQEL
BQAwGzEZMBcGA1UEAwwQQm90a2VlcCBkYXRhYmFzZTAeFw0yNjEwMDgwNDIzMjda
Fw0zNjEwMDUwNDI4MjdaMBsxGTAXBgNVBAMMEEJvdGtlZXAgZGF0YWJhc2UwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDS3yoiu2Ie0pi6HxVRmLIHDbnn
DL3/Xdq9PrxkseTCEcWXeHRU0u/7U/8CzSjDfM1ODYmDLZ/WzzYlpzZcZNddOgVB
YBgjelNkfx7zkhEQR6wY7kWewEROiN6E2fIYX34BhOm00wqYQHjVrKKPO5WostKb
RKj7kMVu+COAZgmMh5bwGED5aj8PE5IcovwkazdL2CLwAnL7Ni5z5jl6Pb0CkYCU
BfXgYyAs3gdazE9cfWr8PPsIcVzAbfJxWgQiIY+gjOuQs3lqL8DzyI4lqBICsbY3
7N1R/21su/nZbZMUwrZehpB2ofqFReBg7O1LnKHVIGxCsO6piKyGO1mrbEwBAgMB
AAGjJzAlMBIGA1UdEwEB/wQIMAYBAf8CAQAwDwYDVR0RBAgwBocEJbsdkjANBgkq
hkiG9w0BAQsFAAOCAQEAvivo/5Umt9+UW9v8WicvBCmbXzUl/UW1j6XY/vrlUT1H
J0eUAq3vjOQ7CFUlIAHbVHHjQPnpZTQZMaFTHjnoFNRak0x44hBFfkTCH6p5F0C2
qLFIiC92by0j3AfY6DOnYAB3JHpjHw2o0A3jr+y2rGBmFXZsImr6VE6av2ErKlpy
o+NiiWvEZRjWXggkY01eMJjpT2hp1kuUwiUm3Y2y+PZ8k5L9+w2p6jqIHqUqOW7x
EiDFAeSUOkouRyIFaxXr2/mjyetpuny0FhRfgZSTX23KWmUkSI3jywpvM5hRltG4
JhcXzXS/qlwMZXTBNHFZLv2ki+adaJ6U0bTv6b7Gxw==
-----END CERTIFICATE-----`;

function createPool(targetHost, connectTimeoutMs) {
  const { Pool } = require('pg');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL');
  const address = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(address.protocol)) throw new Error('DATABASE_URL must be PostgreSQL');
  // sslmode priority: PGSSL_MODE env > sslmode param in DATABASE_URL > 'require'
  const urlSslMode = address.searchParams.get('sslmode') || '';
  const rawMode = (process.env.PGSSL_MODE || urlSslMode || 'require').toLowerCase();
  const sslMode = rawMode === 'verify-full' ? 'verify-full'
                : rawMode === 'disable'      ? 'disable'
                : rawMode === 'no-verify'    ? 'no-verify'
                :                             'require';
  if (!['disable', 'verify-full', 'require', 'no-verify'].includes(sslMode))
    throw new Error('PGSSL_MODE must be disable, require, no-verify or verify-full');
  // verify-full: use CA cert. require/no-verify: SSL on but skip cert check (safe on private network).
  const ca = (process.env.PGSSL_CA_PEM?.replace(/\\n/g, '\n')) || BOTKEEP_DEFAULT_CA;
  const sslConfig = sslMode === 'disable' ? false
                  : sslMode === 'verify-full' ? { rejectUnauthorized: true, ca }
                  : { rejectUnauthorized: false };
  const p = new Pool({
    host: targetHost || process.env.PG_HOST || address.hostname,
    port: Number(process.env.PG_PORT || address.port || 5432),
    user: decodeURIComponent(address.username),
    password: decodeURIComponent(address.password),
    database: decodeURIComponent(address.pathname.slice(1)),
    max: Number(process.env.PG_POOL_MAX || 4),
    connectionTimeoutMillis: connectTimeoutMs || Number(process.env.PG_TIMEOUT_MS || 15000),
    idleTimeoutMillis: 30000,
    ssl: sslConfig,
  });
  p.on('error', (err) => {
    console.warn('[postgres] Pool client error caught:', err.message);
  });
  return p;
}

function poolFor() {
  if (!pool) pool = createPool();
  return pool;
}

async function seedValue(name) {
  try {
    const json = JSON.parse(await fs.readFile(path.join(__dirname, '../data', `${name}.json`), 'utf8'));
    if (name === 'classes' || process.env.SEED_DEMO_DATA === 'true') return json;
    return Array.isArray(json) ? [] : (name === 'attendance' ? { sessions: [] } : {});
  } catch (err) {
    return name === 'classes' ? [{ id: '12A5', name: 'Lớp 12A5' }] : (name === 'cloud_rooms' ? {} : []);
  }
}

async function initializeStorage() {
  if (!initialized) {
    initialized = (async () => {
      const address = new URL(process.env.DATABASE_URL);
      const configuredHost = process.env.PG_HOST || address.hostname;
      const dbPort = Number(process.env.PG_PORT || address.port || 5432);

      // 1. Try configured host directly first (fastest path, works for Vercel & standard hosting)
      const primaryTimeout = Number(process.env.PG_TIMEOUT_MS || 8000);
      try {
        const testPool = createPool(configuredHost, primaryTimeout);
        const client = await testPool.connect();
        await client.query('SELECT 1');
        client.release();
        pool = testPool;
        console.log(`[storage] Connected to ${configuredHost}:${dbPort}`);
      } catch (err) {
        console.log(`[storage] Primary host ${configuredHost}:${dbPort} failed: ${err.message}`);
        
        // 2. Fallbacks for Docker / Pterodactyl container environments
        const hostsToTry = [];
        const gateway = getGatewayIp();
        if (gateway && gateway !== configuredHost) hostsToTry.push(gateway);

        try {
          const fsSync = require('node:fs');
          if (fsSync.existsSync('/etc/hosts')) {
            const hostsFile = fsSync.readFileSync('/etc/hosts', 'utf8');
            for (const line of hostsFile.split('\n')) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 2 && !parts[0].startsWith('#')) {
                const ip = parts[0];
                const names = parts.slice(1);
                if (names.some(n => /postgres|gvcn.?db|db|mysql/i.test(n))) {
                  if (!hostsToTry.includes(ip)) hostsToTry.push(ip);
                }
              }
            }
          }
        } catch {}

        if (getGatewayIp()) {
          console.log(`[storage] Scanning subnet 172.18.x.x for port ${dbPort}...`);
          const subnets = ['172.18.0', '172.18.1', '172.18.2', '172.18.3', '172.18.4', '172.18.5'];
          const scanResults = await Promise.all(subnets.map(s => scanSubnetForPort(s, dbPort, 500)));
          const scannedHosts = scanResults.flat().filter(ip => !hostsToTry.includes(ip));
          if (scannedHosts.length > 0) hostsToTry.push(...scannedHosts);
        }

        for (const h of ['host.docker.internal', '172.17.0.1', '172.18.0.1', '172.19.0.1', '10.0.0.1']) {
          if (!hostsToTry.includes(h) && h !== configuredHost) hostsToTry.push(h);
        }

        let lastError = err;
        for (const h of hostsToTry) {
          const fallbackPool = createPool(h, 4000);
          try {
            const client = await fallbackPool.connect();
            await client.query('SELECT 1');
            client.release();
            pool = fallbackPool;
            console.log(`[storage] Connected via fallback host ${h}:${dbPort}`);
            break;
          } catch (fbErr) {
            lastError = fbErr;
            await fallbackPool.end().catch(() => {});
          }
        }
        if (!pool) throw lastError;
      }

      if (!pool) throw lastError;

      const db = pool;
      await db.query(`CREATE TABLE IF NOT EXISTS public.gvcn_documents (
        name TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      for (const name of ALLOWED) {
        const payload = await seedValue(name);
        await db.query('INSERT INTO public.gvcn_documents(name,payload) VALUES ($1,$2::jsonb) ON CONFLICT(name) DO NOTHING', [name, JSON.stringify(payload)]);
      }
      await db.query('SELECT 1');
    })().catch(error => { initialized = null; throw error; });
  }
  return initialized;
}
function valid(name) {
  if (!ALLOWED.has(name)) throw new Error('Unknown JSON collection');
}
async function ensureSchema(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS public.gvcn_documents (
    name TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
async function readJson(name) {
  valid(name);
  await initializeStorage();
  const client = await poolFor().connect();
  try {
    await ensureSchema(client);
    let result = await client.query('SELECT payload FROM public.gvcn_documents WHERE name=$1', [name]);
    if (!result.rows.length) {
      const payload = await seedValue(name);
      await client.query('INSERT INTO public.gvcn_documents(name,payload) VALUES ($1,$2::jsonb) ON CONFLICT(name) DO NOTHING', [name, JSON.stringify(payload)]);
      result = await client.query('SELECT payload FROM public.gvcn_documents WHERE name=$1', [name]);
    }
    return result.rows[0]?.payload || (name === 'cloud_rooms' ? {} : []);
  } finally {
    client.release();
  }
}
async function updateJson(name, mutate) {
  valid(name);
  await initializeStorage();
  const client = await poolFor().connect();
  try {
    await client.query('BEGIN');
    await ensureSchema(client);
    let found = await client.query('SELECT payload FROM public.gvcn_documents WHERE name=$1 FOR UPDATE', [name]);
    if (!found.rows.length) {
      const initial = await seedValue(name);
      await client.query('INSERT INTO public.gvcn_documents(name,payload) VALUES ($1,$2::jsonb) ON CONFLICT(name) DO NOTHING', [name, JSON.stringify(initial)]);
      found = await client.query('SELECT payload FROM public.gvcn_documents WHERE name=$1 FOR UPDATE', [name]);
    }
    const currentPayload = found.rows[0]?.payload || (name === 'cloud_rooms' ? {} : []);
    const { data, result } = await mutate(currentPayload);
    await client.query('UPDATE public.gvcn_documents SET payload=$2::jsonb, updated_at=NOW() WHERE name=$1', [name, JSON.stringify(data)]);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
async function health() {
  await initializeStorage();
  const res = await poolFor().query(`
    SELECT 
      current_database() as db, 
      current_user as db_user, 
      current_schema() as db_schema,
      current_setting('search_path') as search_path,
      (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'gvcn_documents') as gvcn_table_count,
      (SELECT string_agg(table_schema || '.' || table_name, ', ') FROM information_schema.tables WHERE table_name = 'gvcn_documents') as gvcn_locations
  `);
  return res.rows[0];
}
async function shutdown() { if (pool) await pool.end(); }
module.exports = { readJson, updateJson, initializeStorage, health, shutdown, mode: 'postgresql-jsonb' };
