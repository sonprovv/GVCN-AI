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
    const room = payload['12A5'] || {};
    console.log('Room properties:', Object.keys(room));
    console.log('Class data properties:', room.data ? Object.keys(room.data) : 'no data');
    console.log('Discipline records:', (room.data?.disciplineRecords || room.disciplineRecords)?.map(r => ({ date: r.date, session: r.session })));
    console.log('Academic records:', (room.data?.academicRecords || room.academicRecords)?.map(r => ({ date: r.date, session: r.session, subject: r.subject })));
    pool.end();
  })
  .catch(err => {
    console.error('ERROR:', err);
    pool.end();
  });
