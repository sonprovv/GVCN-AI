'use strict';
process.loadEnvFile();
const { Pool } = require('pg');
const pool = new Pool({
  host: '37.187.29.146',
  port: 33737,
  user: 'botkeep',
  password: 'Ah0cbeir3FTxAJzO_ha30NxbOFcJ8ZN0SOwMhOkqd4Q',
  database: 'app',
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT payload FROM gvcn_documents WHERE name = 'cloud_rooms'")
  .then(res => {
    const payload = res.rows[0]?.payload || {};
    console.log('ROOM KEYS IN BOTKEEP DB:', Object.keys(payload));
    console.log('ROOM 12A5 DATA IN BOTKEEP DB:', JSON.stringify(payload['12A5'], null, 2));
    pool.end();
  })
  .catch(err => {
    console.error('ERROR:', err);
    pool.end();
  });
