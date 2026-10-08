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
const parsedStudents = JSON.parse(rawStudentsJson);
console.log(`[Excel] Loaded ${parsedStudents.length} real students from Excel.`);

if (parsedStudents.length !== 46) {
  throw new Error(`Expected 46 students, got ${parsedStudents.length}`);
}

const teamMap = {
  'Tổ 1': 'team-1',
  'Tổ 2': 'team-2',
  'Tổ 3': 'team-3',
  'Tổ 4': 'team-4'
};

const now = new Date().toISOString();
const realStudents = parsedStudents.map(s => ({
  id: `hs-${String(s.stt).padStart(2, '0')}`,
  stt: s.stt,
  fullName: s.name,
  birthDate: s.birthDate || '2008-01-01',
  gender: s.gender || 'Nam',
  teamId: teamMap[s.team] || 'team-1',
  role: s.role || 'Thành viên',
  parentName: s.parentName || '',
  parentRelation: s.parentRelation || 'Phụ huynh',
  parentPhone: s.parentPhone || '',
  parentEmail: s.parentEmail || '',
  notes: s.notes || '',
  initialPoints: 10,
  createdAt: '2026-09-01',
  updatedAt: now.slice(0, 10)
}));

console.log('Sample real students:');
console.log(' 1.', realStudents[0].fullName, 'Role:', realStudents[0].role, 'Team:', realStudents[0].teamId);
console.log(' 2.', realStudents[1].fullName, 'Role:', realStudents[1].role, 'Team:', realStudents[1].teamId);
console.log('46.', realStudents[45].fullName, 'Role:', realStudents[45].role, 'Team:', realStudents[45].teamId);

const teams = [
  { id: 'team-1', name: 'Tổ 1', color: '#2563EB', directPoints: 0, createdAt: '2026-09-01' },
  { id: 'team-2', name: 'Tổ 2', color: '#059669', directPoints: 0, createdAt: '2026-09-01' },
  { id: 'team-3', name: 'Tổ 3', color: '#D97706', directPoints: 0, createdAt: '2026-09-01' },
  { id: 'team-4', name: 'Tổ 4', color: '#7C3AED', directPoints: 0, createdAt: '2026-09-01' }
];

async function updateAll() {
  // 1. Update backend/data/cloud_rooms.json
  const cloudRoomsFile = path.resolve(__dirname, '../backend/data/cloud_rooms.json');
  let rooms = {};
  if (fs.existsSync(cloudRoomsFile)) {
    try { rooms = JSON.parse(fs.readFileSync(cloudRoomsFile, 'utf8')); } catch {}
  }

  const existingRoom = rooms['12A5'] || {};
  const existingData = existingRoom.data || {};

  const cleanRoomData = {
    ...existingData,
    version: '2.0',
    timestamp: now,
    settings: {
      ...(existingData.settings || {}),
      className: '12A5',
      schoolName: 'THPT VŨ TIÊN',
      academicYear: '2026-2027',
      teacherName: 'GVCN Vũ Tiến',
      monitorStudentName: 'Phạm Thị Như Quỳnh', // STT 30 Lớp trưởng thật của 12A5
      teacherPin: '2026',
      studentCount: 46
    },
    teams,
    students: realStudents,
    attendance: [], // Xóa sạch attendance mock cũ
    competition: [], // Xóa sạch thi đua mock cũ
    disciplineRecords: [], // Xóa sạch nề nếp mock cũ
    academicRecords: [], // Xóa sạch học tập mock cũ
    monthlyConduct: []
  };

  rooms['12A5'] = {
    data: cleanRoomData,
    activityLogs: [
      {
        id: `log-${Date.now()}-init`,
        timestamp: now,
        role: 'teacher',
        author: 'GVCN Vũ Tiến',
        summary: 'Cập nhật danh sách chính thức 46 học sinh lớp 12A5 từ file Mau_Nhap_Hoc_Sinh_12A5.xlsx'
      }
    ],
    updatedAt: now
  };

  fs.writeFileSync(cloudRoomsFile, JSON.stringify(rooms, null, 2), 'utf8');
  console.log('Saved backend/data/cloud_rooms.json with 46 real students.');

  // 2. Also update PostgreSQL database via storage.updateJson
  await storage.initializeStorage();
  console.log('[Storage initialized, mode:', storage.mode, ']');

  await storage.updateJson('cloud_rooms', (dbRooms = {}) => {
    if (!dbRooms || typeof dbRooms !== 'object' || Array.isArray(dbRooms)) dbRooms = {};
    dbRooms['12A5'] = rooms['12A5'];
    return { data: dbRooms, result: rooms['12A5'] };
  });

  console.log('Successfully updated PostgreSQL database cloud_rooms for 12A5!');

  // Check read back
  const readBack = await storage.readJson('cloud_rooms');
  const r12 = readBack['12A5'];
  console.log('Read back verification:');
  console.log(' Student count in DB:', r12.data?.students?.length);
  console.log(' 1.', r12.data?.students?.[0]?.fullName);
  console.log('46.', r12.data?.students?.[45]?.fullName);

  await storage.shutdown();
  console.log('Completed successfully!');
}

updateAll().catch(err => {
  console.error('Error updating:', err);
  process.exit(1);
});
