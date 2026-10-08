'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('password + session cookie protects cloud-ready API', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'gvcn-login-test-'));
  try {
    for (const file of await fs.readdir(path.join(__dirname, '../backend/data')))
      await fs.copyFile(path.join(__dirname, '../backend/data', file), path.join(temp, file));
    process.env.GVCN_DATA_DIR = temp;
    process.env.APP_PASSWORD = 'temporary-test-password';
    process.env.SESSION_SECRET = 'temporary-test-signing-secret-with-minimum-length';
    const { server } = require('../backend/server');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      let res = await fetch(base + '/api/auth/status');
      assert.equal((await res.json()).authenticated, false);
      res = await fetch(base + '/api/students');
      assert.equal(res.status, 401);
      res = await fetch(base + '/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({password:'wrong'})});
      assert.equal(res.status, 401);
      res = await fetch(base + '/api/auth/login', { method:'POST', headers:{'content-type':'application/json','origin':'https://attacker.example'}, body: JSON.stringify({password:process.env.APP_PASSWORD})});
      assert.equal(res.status, 403);
      res = await fetch(base + '/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({password:process.env.APP_PASSWORD})});
      assert.equal(res.status, 200);
      const cookie = res.headers.get('set-cookie').split(';')[0];
      assert.match(cookie, /gvcn_session=/);
      res = await fetch(base + '/api/students', {headers:{cookie}});
      assert.equal(res.status, 200);
      res = await fetch(base + '/api/auth/logout', {method:'POST',headers:{cookie}});
      assert.equal(res.status, 200);
      assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
      console.log('PASS: login blocked unauthenticated API, rejected cross-origin login, and provided session cookie');
    } finally { await new Promise(resolve=>server.close(resolve)); }
  } finally { await fs.rm(temp, {recursive:true,force:true}); }
});
