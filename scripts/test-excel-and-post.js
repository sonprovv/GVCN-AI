'use strict';
const path = require('node:path');
const { execSync } = require('node:child_process');

try {
  if (typeof process.loadEnvFile === 'function') process.loadEnvFile();
  else {
    const fs = require('node:fs');
    if (fs.existsSync('.env')) {
      for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
        const [k, ...v] = line.trim().split('=');
        if (k && !k.startsWith('#') && !process.env[k]) process.env[k] = v.join('=').trim();
      }
    }
  }
} catch {}

const { server } = require('../backend/server');
const storage = require('../backend/storage');

const pyPath = path.resolve(__dirname, 'parse_excel.py');
const rawStudentsJson = execSync(`python "${pyPath}"`, { encoding: 'utf8' });
const parsedStudents = JSON.parse(rawStudentsJson);
console.log(`[Excel] Extracted ${parsedStudents.length} students from Excel`);

if (parsedStudents.length !== 46) {
  throw new Error(`Expected 46 students, but got ${parsedStudents.length}`);
}

const teamMap = {
  'Tổ 1': 'team-1',
  'Tổ 2': 'team-2',
  'Tổ 3': 'team-3',
  'Tổ 4': 'team-4'
};

const formattedStudents = parsedStudents.map((s) => ({
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
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10)
}));

async function main() {
  await storage.initializeStorage();
  const testPort = 3457;

  await new Promise(resolve => server.listen(testPort, '127.0.0.1', resolve));
  console.log(`[Test server listening on port ${testPort}]`);

  try {
    // 1. Fetch current room 12A5 data
    const getRes = await fetch(`http://127.0.0.1:${testPort}/api/cloud/12A5`);
    console.log('GET /api/cloud/12A5 status:', getRes.status);
    let existingRoomData = {};
    if (getRes.ok) {
      const json = await getRes.json();
      existingRoomData = json.data || {};
    }

    // 2. Prepare payload with the 46 students from Excel
    const updatedClassData = {
      ...existingRoomData,
      version: '2.0',
      timestamp: new Date().toISOString(),
      settings: {
        ...(existingRoomData.settings || {}),
        className: '12A5',
        schoolName: 'THPT VŨ TIÊN',
        academicYear: '2026-2027',
        studentCount: 46
      },
      students: formattedStudents
    };

    const postPayload = {
      data: updatedClassData,
      role: 'teacher',
      authorName: 'GVCN Vũ Tiến',
      actionSummary: `Nhập danh sách chuẩn ${formattedStudents.length} học sinh từ file Mau_Nhap_Hoc_Sinh_12A5.xlsx`
    };

    // 3. Test POST /api/cloud/12A5
    console.log(`Sending POST /api/cloud/12A5 with ${formattedStudents.length} students...`);
    const postRes = await fetch(`http://127.0.0.1:${testPort}/api/cloud/12A5`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    });

    console.log('POST /api/cloud/12A5 response status:', postRes.status);
    const postResult = await postRes.json();
    console.log('POST /api/cloud/12A5 result:', postResult);

    if (postRes.status !== 200 || !postResult.success) {
      throw new Error(`POST /api/cloud/12A5 failed! Status: ${postRes.status}`);
    }

    // 4. Verify by GET /api/cloud/12A5
    const verifyGet = await fetch(`http://127.0.0.1:${testPort}/api/cloud/12A5`);
    const verifyData = await verifyGet.json();
    console.log('GET /api/cloud/12A5 after POST, student count:', verifyData.data?.students?.length);
    console.log('First student in Cloud:', verifyData.data?.students?.[0]?.stt, verifyData.data?.students?.[0]?.fullName, verifyData.data?.students?.[0]?.teamId);
    console.log('Last student in Cloud:', verifyData.data?.students?.[45]?.stt, verifyData.data?.students?.[45]?.fullName, verifyData.data?.students?.[45]?.teamId);

    // 5. Verify GET /api/cloud/12A5/status
    const statusRes = await fetch(`http://127.0.0.1:${testPort}/api/cloud/12A5/status`);
    const statusJson = await statusRes.json();
    console.log('GET /api/cloud/12A5/status:', statusRes.status, statusJson);

    if (
      verifyData.data?.students?.length === 46 &&
      verifyData.data?.students?.[0]?.fullName === 'Nguyễn Thị Thái An' &&
      verifyData.data?.students?.[45]?.fullName === 'Lê Thị Tường Vi' &&
      statusRes.status === 200 &&
      statusJson.exists === true
    ) {
      console.log('\n======================================================');
      console.log('>>> TEST THÀNH CÔNG: API POST DATA ĐÃ CHẠY HOÀN HẢO! <<<');
      console.log('>>> 46 HỌC SINH TỪ FILE EXCEL ĐÃ LƯU LÊN CLOUD POSTGRESQL! <<<');
      console.log('======================================================\n');
    } else {
      console.error('>>> TEST FAILED: Verification assertions did not match! <<<');
    }
  } finally {
    server.close();
    await storage.shutdown();
    console.log('[Test server closed]');
  }
}

main().catch(err => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
