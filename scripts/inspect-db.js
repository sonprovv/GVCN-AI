'use strict';
process.loadEnvFile();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || '37.187.29.146',
  port: Number(process.env.PG_PORT || 33737),
  user: 'botkeep',
  password: 'Ah0cbeir3FTxAJzO_ha30NxbOFcJ8ZN0SOwMhOkqd4Q',
  database: 'app',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log('--- DANH SÁCH BẢNG TRONG DATABASE BOTKEEP ---');
  console.log(tables.rows.map(r => r.table_name));

  const docs = await pool.query('SELECT name, length(payload::text) as len, updated_at FROM gvcn_documents ORDER BY name');
  console.log('\n--- CHI TIẾT TỪNG DOCUMENT TRONG gvcn_documents ---');
  for (const d of docs.rows) {
    console.log(`- ${d.name.padEnd(14)} : ${d.len.toString().padStart(6)} bytes | ${d.updated_at.toISOString()}`);
  }

  // Sample check students
  const stRes = await pool.query("SELECT payload FROM gvcn_documents WHERE name = 'students'");
  const st = stRes.rows[0]?.payload || [];
  console.log(`\nTổng số học sinh trong table students: ${st.length}`);
  console.log('3 học sinh đầu tiên:', st.slice(0, 3).map(s => `${s.id}: ${s.name} (${s.classId})`));

  // Sample check cloud_rooms
  const crRes = await pool.query("SELECT payload FROM gvcn_documents WHERE name = 'cloud_rooms'");
  const cr = crRes.rows[0]?.payload || {};
  console.log(`\nPhòng trong cloud_rooms: ${Object.keys(cr).join(', ')}`);
  console.log(`Số học sinh trong phòng 12A5: ${cr['12A5']?.data?.students?.length}`);
  console.log('3 học sinh đầu trong phòng 12A5:', cr['12A5']?.data?.students?.slice(0, 3).map(s => `${s.stt}. ${s.fullName} (${s.role || 'Học sinh'})`));

  await pool.end();
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
