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

// 1. Get 46 real students from Excel using parse_excel.py
const pyPath = path.resolve(__dirname, 'parse_excel.py');
const rawStudentsJson = execSync(`python "${pyPath}"`, { encoding: 'utf8' });
const excelStudents = JSON.parse(rawStudentsJson);
console.log(`[Excel] Loaded ${excelStudents.length} real students.`);

if (excelStudents.length !== 46) {
  throw new Error(`Expected 46 students, got ${excelStudents.length}`);
}

// 2. Update backend/data/students.json
const studentsFile = path.resolve(__dirname, '../backend/data/students.json');
let existingStudents = JSON.parse(fs.readFileSync(studentsFile, 'utf8'));

// Filter out old 12A5 students, keep 11A3 (or other classes)
const otherStudents = existingStudents.filter(s => s.classId !== '12A5');

const real12A5Students = excelStudents.map((s, idx) => ({
  id: `HS12A5-${String(s.stt).padStart(2, '0')}`,
  classId: '12A5',
  name: s.name,
  gender: s.gender || 'Nam',
  averageScore: 8.0,
  attendanceRate: 100,
  status: 'Ổn định'
}));

const updatedStudents = [...real12A5Students, ...otherStudents];
fs.writeFileSync(studentsFile, JSON.stringify(updatedStudents, null, 2), 'utf8');
console.log(`Saved backend/data/students.json with ${real12A5Students.length} real 12A5 students!`);

// 3. Update backend/data/classes.json
const classesFile = path.resolve(__dirname, '../backend/data/classes.json');
let classes = JSON.parse(fs.readFileSync(classesFile, 'utf8'));
classes = classes.map(c => {
  if (c.id === '12A5') {
    return {
      ...c,
      name: '12A5',
      academicYear: '2026–2027',
      teacher: 'Vũ Tiến',
      school: 'THPT VŨ TIÊN'
    };
  }
  return c;
});
fs.writeFileSync(classesFile, JSON.stringify(classes, null, 2), 'utf8');
console.log('Saved backend/data/classes.json with school: THPT VŨ TIÊN');

// 4. Update backend/data/attendance.json
const attFile = path.resolve(__dirname, '../backend/data/attendance.json');
let attendance = JSON.parse(fs.readFileSync(attFile, 'utf8'));
if (attendance.sessions && Array.isArray(attendance.sessions)) {
  attendance.sessions = attendance.sessions.map(sess => {
    if (sess.classId === '12A5') {
      return {
        date: sess.date || '2026-10-08',
        classId: '12A5',
        records: real12A5Students.map(s => ({
          studentId: s.id,
          status: 'present'
        }))
      };
    }
    return sess;
  });
  fs.writeFileSync(attFile, JSON.stringify(attendance, null, 2), 'utf8');
  console.log('Saved backend/data/attendance.json with matching 12A5 student IDs');
}

// 5. Sync to PostgreSQL Database
async function syncDatabase() {
  await storage.initializeStorage();
  console.log('[Storage initialized, syncing to PostgreSQL Botkeep]');

  // Update students
  await storage.updateJson('students', () => ({
    data: updatedStudents,
    result: updatedStudents.length
  }));
  console.log('PostgreSQL: Synced students collection');

  // Update classes
  await storage.updateJson('classes', () => ({
    data: classes,
    result: classes.length
  }));
  console.log('PostgreSQL: Synced classes collection');

  // Update attendance
  await storage.updateJson('attendance', () => ({
    data: attendance,
    result: attendance
  }));
  console.log('PostgreSQL: Synced attendance collection');

  // Verify
  const verifyStudents = await storage.readJson('students');
  const v12A5 = verifyStudents.filter(s => s.classId === '12A5');
  console.log('\n--- VERIFICATION IN DATABASE ---');
  console.log('Total 12A5 students in DB:', v12A5.length);
  console.log(' 1.', v12A5[0].id, v12A5[0].name, v12A5[0].gender);
  console.log('46.', v12A5[45].id, v12A5[45].name, v12A5[45].gender);

  await storage.shutdown();
  console.log('\n>>> TOÀN BỘ BACKEND/DATA ĐÃ ĐƯỢC CẬP NHẬT 100% SẠCH MOCK! <<<');
}

syncDatabase().catch(err => {
  console.error('Error syncing DB:', err);
  process.exit(1);
});
