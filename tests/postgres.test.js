'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('Postgres JSONB adapter seeds only when absent, writes via transaction, preserves rows', async () => {
  const originalLoad = Module._load;
  const original = { DATABASE_URL:process.env.DATABASE_URL, PGSSL_MODE:process.env.PGSSL_MODE, SEED_DEMO_DATA:process.env.SEED_DEMO_DATA };
  const data = new Map();
  const events = [];
  class Pool {
    async query(sql, params=[]) {
      events.push(sql.split(' ')[0]);
      if (sql.startsWith('INSERT INTO gvcn_documents')) {
        if (!data.has(params[0])) data.set(params[0], JSON.parse(params[1]));
        return {rows:[]};
      }
      if (sql.startsWith('SELECT payload')) return {rows: data.has(params[0]) ? [{payload:structuredClone(data.get(params[0]))}] : []};
      if (sql.startsWith('UPDATE gvcn_documents')) {data.set(params[0], JSON.parse(params[1])); return {rows:[]};}
      return {rows:[{ok:1}]};
    }
    async connect() { return { query:this.query.bind(this), release() {} }; }
    async end() {}
  }
  try {
    process.env.DATABASE_URL='postgresql://user:encoded%40pass@pg.example.org:5432/mydb';
    process.env.PGSSL_MODE='verify-full';
    process.env.SEED_DEMO_DATA='false';
    Module._load = function(request, parent, isMain) {if(request==='pg')return {Pool};return originalLoad.call(this,request,parent,isMain);};
    const store = require('../backend/storage/postgresStore');
    await store.initializeStorage();
    assert.equal(store.mode,'postgresql-jsonb');
    assert.equal((await store.readJson('students')).length,0);
    assert.ok((await store.readJson('classes')).length);
    await store.updateJson('students', students => {students.push({id:'S1'});return {data:students,result:true};});
    assert.deepEqual(await store.readJson('students'),[{id:'S1'}]);
    await store.initializeStorage();
    assert.deepEqual(await store.readJson('students'),[{id:'S1'}]);
    assert.ok(events.includes('BEGIN') && events.includes('COMMIT') && events.includes('UPDATE'));
    await store.shutdown();
    console.log('PASS: mock PostgreSQL JSONB store, seed-once, persisted transaction updates');
  } finally {
    Module._load = originalLoad;
    for (const [k,v] of Object.entries(original)) {if(v === undefined) delete process.env[k]; else process.env[k]=v;}
  }
});
