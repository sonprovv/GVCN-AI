'use strict';
process.loadEnvFile();
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || '37.187.29.146',
  port: Number(process.env.PG_PORT || 33737),
  user: 'botkeep',
  password: 'Ah0cbeir3FTxAJzO_ha30NxbOFcJ8ZN0SOwMhOkqd4Q',
  database: 'app',
  ssl: { rejectUnauthorized: false }
});

const COLLECTIONS = [
  'classes',
  'students',
  'attendance',
  'subjects',
  'tasks',
  'templates',
  'reports',
  'messages',
  'cloud_rooms'
];

async function seed() {
  console.log('Connecting to PostgreSQL Botkeep...');
  const client = await pool.connect();
  console.log('Connected successfully!');

  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS gvcn_documents (
      name TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    for (const name of COLLECTIONS) {
      const filePath = path.join(__dirname, '../backend/data', `${name}.json`);
      const raw = await fs.readFile(filePath, 'utf8');
      const json = JSON.parse(raw);

      await client.query(
        `INSERT INTO gvcn_documents (name, payload, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (name) DO UPDATE
         SET payload = EXCLUDED.payload, updated_at = NOW()`,
        [name, JSON.stringify(json)]
      );

      const count = Array.isArray(json)
        ? `${json.length} bản ghi`
        : typeof json === 'object'
          ? `${Object.keys(json).length} trường/phòng`
          : '1';
      console.log(`[SEED] OK: ${name} (${count})`);
    }

    await client.query('COMMIT');
    console.log('\n--- TỔNG KẾT DỮ LIỆU ĐÃ NẠP TRÊN BOTKEEP ---');
    const res = await client.query('SELECT name, length(payload::text) as size_bytes, updated_at FROM gvcn_documents ORDER BY name');
    for (const row of res.rows) {
      console.log(`- ${row.name.padEnd(14)} : ${row.size_bytes.toString().padStart(6)} bytes | ${row.updated_at.toISOString()}`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Lỗi khi nạp dữ liệu:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
