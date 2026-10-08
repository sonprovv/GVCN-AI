'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  if (typeof process.loadEnvFile === 'function') process.loadEnvFile();
  else {
    if (fs.existsSync('.env')) {
      for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
        const [k, ...v] = line.trim().split('=');
        if (k && !k.startsWith('#') && !process.env[k]) process.env[k] = v.join('=').trim();
      }
    }
  }
} catch {}

const storage = require('../backend/storage');

// 1. Get real 46 students
const pyPath = path.resolve(__dirname, 'parse_excel.py');
const rawStudentsJson = execSync(`python "${pyPath}"`, { encoding: 'utf8' });
const excelStudents = JSON.parse(rawStudentsJson);

const real12A5Students = excelStudents.map(s => ({
  id: `HS12A5-${String(s.stt).padStart(2, '0')}`,
  classId: '12A5',
  name: s.name,
  gender: s.gender || 'Nam',
  averageScore: 8.0,
  attendanceRate: 100,
  status: 'Ổn định'
}));

// 2. Clear attendance.json -> empty sessions
const attFile = path.resolve(__dirname, '../backend/data/attendance.json');
const cleanAttendance = { sessions: [] };
fs.writeFileSync(attFile, JSON.stringify(cleanAttendance, null, 2), 'utf8');
console.log('1. Cleared backend/data/attendance.json -> sessions: []');

// 3. Clean students.json -> ONLY the 46 real 12A5 students
const studentsFile = path.resolve(__dirname, '../backend/data/students.json');
fs.writeFileSync(studentsFile, JSON.stringify(real12A5Students, null, 2), 'utf8');
console.log(`2. Cleaned backend/data/students.json -> exactly ${real12A5Students.length} real students, 0 demo students.`);

// 4. Clean classes.json -> ONLY 12A5
const classesFile = path.resolve(__dirname, '../backend/data/classes.json');
const cleanClasses = [
  {
    id: '12A5',
    name: '12A5',
    academicYear: '2026–2027',
    teacher: 'Vũ Tiến',
    school: 'THPT VŨ TIÊN'
  }
];
fs.writeFileSync(classesFile, JSON.stringify(cleanClasses, null, 2), 'utf8');
console.log('3. Cleaned backend/data/classes.json -> only class 12A5 THPT VŨ TIÊN.');

// 5. Clean tasks.json -> empty []
const tasksFile = path.resolve(__dirname, '../backend/data/tasks.json');
fs.writeFileSync(tasksFile, JSON.stringify([], null, 2), 'utf8');
console.log('4. Cleared backend/data/tasks.json -> []');

// 6. Clean messages.json -> empty []
const msgFile = path.resolve(__dirname, '../backend/data/messages.json');
fs.writeFileSync(msgFile, JSON.stringify([], null, 2), 'utf8');
console.log('5. Cleared backend/data/messages.json -> []');

// 7. Sync everything to PostgreSQL Database
async function syncDatabase() {
  await storage.initializeStorage();
  console.log('\n[Storage initialized, syncing cleaned collections to PostgreSQL Botkeep...]');

  await storage.updateJson('attendance', () => ({
    data: cleanAttendance,
    result: cleanAttendance
  }));
  console.log('PostgreSQL: attendance -> sessions: []');

  await storage.updateJson('students', () => ({
    data: real12A5Students,
    result: real12A5Students.length
  }));
  console.log(`PostgreSQL: students -> exactly ${real12A5Students.length} real students`);

  await storage.updateJson('classes', () => ({
    data: cleanClasses,
    result: cleanClasses.length
  }));
  console.log('PostgreSQL: classes -> only 12A5');

  await storage.updateJson('tasks', () => ({
    data: [],
    result: 0
  }));
  console.log('PostgreSQL: tasks -> []');

  await storage.updateJson('messages', () => ({
    data: [],
    result: 0
  }));
  console.log('PostgreSQL: messages -> []');

  // Verify in PostgreSQL
  const dbAtt = await storage.readJson('attendance');
  const dbStudents = await storage.readJson('students');
  const dbClasses = await storage.readJson('classes');
  const dbTasks = await storage.readJson('tasks');
  const dbMsgs = await storage.readJson('messages');

  console.log('\n--- VERIFICATION IN POSTGRESQL ---');
  console.log('attendance.sessions count:', dbAtt.sessions?.length);
  console.log('students count           :', dbStudents.length);
  console.log('classes count            :', dbClasses.length);
  console.log('tasks count              :', dbTasks.length);
  console.log('messages count           :', dbMsgs.length);

  await storage.shutdown();
  console.log('\n>>> ĐÃ XÓA SẠCH TOÀN BỘ DATA MOCK KHỎI BACKEND/DATA VÀ DATABASE THÀNH CÔNG! <<<');
}

syncDatabase().catch(err => {
  console.error('Error syncing:', err);
  process.exit(1);
});
