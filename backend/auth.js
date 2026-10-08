'use strict';
const crypto = require('node:crypto');
const { URL } = require('node:url');

const password = process.env.APP_PASSWORD || '';
const secret = process.env.SESSION_SECRET || '';
const enabled = !!(password && secret);
if (process.env.NODE_ENV === 'production' && !enabled) {
  throw new Error('Production requires APP_PASSWORD and SESSION_SECRET');
}
if (!!password !== !!secret) throw new Error('Set both APP_PASSWORD and SESSION_SECRET, or neither for local development');
if (enabled && (password.length < 12 || secret.length < 32)) {
  throw new Error('APP_PASSWORD needs >=12 characters, SESSION_SECRET needs >=32 characters');
}
const cookieName = 'gvcn_session';
const lifetime = 12 * 60 * 60;
const failures = new Map();
function respond(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function hmac(data) { return crypto.createHmac('sha256', secret).update(data).digest('base64url'); }
function token() {
  const data = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000) + lifetime, nonce: crypto.randomBytes(12).toString('hex') })).toString('base64url');
  return `${data}.${hmac(data)}`;
}
function authorized(req) {
  if (!enabled) return true;
  const cookie = (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x => x.startsWith(cookieName + '='));
  if (!cookie) return false;
  const candidate = cookie.slice(cookieName.length + 1);
  const [payload, mac, extra] = candidate.split('.');
  if (!payload || !mac || extra || mac.length !== 43) return false;
  const expected = hmac(payload);
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof decoded.exp === 'number' && decoded.exp > Math.floor(Date.now()/1000);
  } catch { return false; }
}
function secureCookie(value, maxAge) {
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
async function readLoginBody(req) {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return null; }
    }
  }
  if (!String(req.headers['content-type'] || '').includes('application/json')) return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // CLI or older clients; cookie+SameSite still required.
  try {
    const o = new URL(origin);
    if (process.env.PUBLIC_ORIGIN) return o.origin === new URL(process.env.PUBLIC_ORIGIN).origin;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return o.host === host;
  } catch { return false; }
}
async function handleAuth(req, res, url) {
  if (url.pathname === '/api/auth/status' && req.method === 'GET') {
    respond(res, 200, { authenticated: authorized(req), required: enabled });
    return true;
  }
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    if (!sameOrigin(req)) { respond(res, 403, { error: { message:'Origin không hợp lệ' } }); return true; }
    if (!enabled) { respond(res, 200, { authenticated: true }); return true; }
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let record = failures.get(ip) || { count: 0, since: now };
    if (now - record.since > 15*60_000) record = { count: 0, since: now };
    if (record.count >= 8) { respond(res, 429, { error: {message:'Quá nhiều lần thử, hãy thử lại sau 15 phút'} }); return true; }
    const body = await readLoginBody(req);
    const supplied = Buffer.from(typeof body?.password === 'string' ? body.password : '');
    const correct = Buffer.from(password);
    const matched = supplied.length === correct.length && crypto.timingSafeEqual(supplied, correct);
    if (!matched) {
      failures.set(ip, { count: record.count + 1, since: record.since });
      respond(res, 401, { error: {message:'Mật khẩu không chính xác'} });
      return true;
    }
    failures.delete(ip);
    res.setHeader('Set-Cookie', secureCookie(token(), lifetime));
    respond(res, 200, { authenticated: true });
    return true;
  }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    if (!sameOrigin(req)) { respond(res, 403, { error: {message:'Origin không hợp lệ'} }); return true; }
    res.setHeader('Set-Cookie', secureCookie('', 0));
    respond(res, 200, { authenticated: false });
    return true;
  }
  return false;
}
function ensureAccess(req, res) {
  if (!authorized(req)) {
    respond(res, 401, {error: {code:401, message:'Vui lòng đăng nhập để sử dụng GVCN 360'}});
    return false;
  }
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && !sameOrigin(req)) {
    respond(res, 403, {error: {code:403, message:'Origin không hợp lệ'}});
    return false;
  }
  return true;
}
module.exports = { handleAuth, ensureAccess, authorized, enabled };
