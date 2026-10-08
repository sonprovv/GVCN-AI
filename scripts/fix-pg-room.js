'use strict';
process.loadEnvFile();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const defaultTeams = [
  { id: 'team-1', name: 'Tổ 1', color: 'blue', directPoints: 0, createdAt: '2026-09-01' },
  { id: 'team-2', name: 'Tổ 2', color: 'emerald', directPoints: 0, createdAt: '2026-09-01' },
  { id: 'team-3', name: 'Tổ 3', color: 'amber', directPoints: 0, createdAt: '2026-09-01' },
  { id: 'team-4', name: 'Tổ 4', color: 'purple', directPoints: 0, createdAt: '2026-09-01' }
];

async function fixPostgresRoom() {
  const res = await pool.query("SELECT payload FROM gvcn_documents WHERE name = 'cloud_rooms'");
  const rooms = res.rows[0]?.payload || {};
  const room12A5 = rooms['12A5'] || {};
  const curData = room12A5.data || {};

  const fullData = {
    version: '2.0',
    timestamp: new Date().toISOString(),
    settings: {
      className: '12A5',
      schoolName: 'THPT VŨ TIÊN',
      academicYear: '2026-2027',
      teacherName: 'GVCN Vũ Tiến',
      monitorStudentName: 'Phạm Thị Như Quỳnh',
      studentCount: curData.students?.length || 46,
      ...(curData.settings || {})
    },
    teams: Array.isArray(curData.teams) && curData.teams.length > 0 ? curData.teams : defaultTeams,
    students: curData.students || [],
    attendance: Array.isArray(curData.attendance) ? curData.attendance : [],
    criteria: Array.isArray(curData.criteria) ? curData.criteria : [
      { id: 'crit-1', name: 'Học tập tốt, phát biểu xây dựng bài', points: 2, category: 'academic' },
      { id: 'crit-2', name: 'Tham gia phong trào, văn nghệ', points: 5, category: 'activity' }
    ],
    competition: Array.isArray(curData.competition) ? curData.competition : [],
    badgeAwards: Array.isArray(curData.badgeAwards) ? curData.badgeAwards : [],
    activities: Array.isArray(curData.activities) ? curData.activities : [],
    tasks: Array.isArray(curData.tasks) ? curData.tasks : [],
    duty: Array.isArray(curData.duty) ? curData.duty : [],
    classTables: Array.isArray(curData.classTables) ? curData.classTables : [],
    teacherNotes: Array.isArray(curData.teacherNotes) ? curData.teacherNotes : [],
    parentComms: Array.isArray(curData.parentComms) ? curData.parentComms : [],
    disciplineCriteria: Array.isArray(curData.disciplineCriteria) ? curData.disciplineCriteria : [],
    disciplineRecords: Array.isArray(curData.disciplineRecords) ? curData.disciplineRecords : [],
    academicCriteria: Array.isArray(curData.academicCriteria) ? curData.academicCriteria : [],
    academicRecords: Array.isArray(curData.academicRecords) ? curData.academicRecords : [],
    monthlyConduct: Array.isArray(curData.monthlyConduct) ? curData.monthlyConduct : []
  };

  rooms['12A5'] = {
    ...room12A5,
    data: fullData,
    updatedAt: new Date().toISOString()
  };

  await pool.query("UPDATE gvcn_documents SET payload = $1::jsonb, updated_at = NOW() WHERE name = 'cloud_rooms'", [JSON.stringify(rooms)]);
  console.log('Successfully updated cloud_rooms in PostgreSQL with complete data schema!');
  console.log('Students count:', fullData.students.length);
  console.log('Teams count:', fullData.teams.length);
  await pool.end();
}

fixPostgresRoom().catch(console.error);
