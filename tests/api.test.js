'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// All writes go into an isolated temporary data directory, not the delivered demo JSON.
test('GVCN REST API + JSON persistence', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'gvcn-api-test-'));
  try {
    for (const file of await fs.readdir(path.join(__dirname, '../backend/data'))) {
      await fs.copyFile(path.join(__dirname, '../backend/data', file), path.join(temp, file));
    }
    process.env.GVCN_DATA_DIR = temp;
    const { server } = require('../backend/server');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (pathname, method = 'GET', body) => {
      const res = await fetch(base + pathname, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status, value: await res.json() };
    };
    try {
      let response = await fetch(base + '/');
      assert.equal(response.status, 200);
      assert.match(await response.text(), /GVCN 360/);
      response = await fetch(base + '/src/main.js');
      assert.equal(response.status, 200);
      assert.match(await response.text(), /initDashboard/);

      let result = await request('/api/health');
      assert.equal(result.value.ok, true);
      result = await request('/api/classes');
      assert.equal(result.value.data.length, 2);
      result = await request('/api/dashboard?classId=12A5&date=2026-10-08');
      assert.equal(result.value.data.students.total, 42);
      assert.equal(result.value.data.students.female, 24);
      assert.equal(result.value.data.attendance.absent, 1);
      assert.equal(result.value.data.attendance.late, 1);
      const original = await request('/api/students?classId=12A5');
      assert.equal(original.value.data.length, 42);
      const invalid = await request('/api/students', 'POST', { classId: '12A5', name: 'Lỗi', gender: 'Không rõ', averageScore: 50, attendanceRate: 120, status: 'Ổn định' });
      assert.equal(invalid.status, 400);
      assert.equal((await request('/api/students?classId=12A5')).value.total, 42);
      const created = await request('/api/students', 'POST', { classId: '12A5', name: 'Học sinh kiểm thử', gender: 'Nữ', averageScore: 8.5, attendanceRate: 100, status: 'Ổn định' });
      assert.equal(created.status, 201);
      const newId = created.value.data.id;
      assert.equal((await request('/api/students?classId=12A5&q=ki%E1%BB%83m%20th%E1%BB%AD')).value.data.length, 1);
      const patched = await request('/api/students/' + newId, 'PATCH', { status: 'Theo dõi' });
      assert.equal(patched.value.data.status, 'Theo dõi');
      const fileStudents = JSON.parse(await fs.readFile(path.join(temp, 'students.json'), 'utf8'));
      assert.equal(fileStudents.find(s => s.id === newId).status, 'Theo dõi');
      assert.equal((await request('/api/dashboard?classId=12A5')).value.data.students.total, 43);

      const att = await request('/api/attendance?date=2026-10-08&classId=12A5');
      assert.equal(att.value.data.records.length, 43);
      const modified = att.value.data.records.map(r => ({ studentId: r.studentId, status: r.studentId === newId ? 'absent' : r.state }));
      const badAttendance = await request('/api/attendance/2026-10-08', 'PUT', { classId: '12A5', records: modified.slice(0, 1) });
      assert.equal(badAttendance.status, 400);
      const saved = await request('/api/attendance/2026-10-08', 'PUT', { classId: '12A5', records: modified });
      assert.equal(saved.status, 200);
      assert.equal(saved.value.data.stats.absent, 2);
      assert.equal((await request('/api/attendance?date=2026-10-08&classId=12A5')).value.data.stats.absent, 2);
      const fileAttendance = JSON.parse(await fs.readFile(path.join(temp, 'attendance.json'), 'utf8'));
      assert.ok(fileAttendance.sessions[0].records.some(r => r.studentId === newId && r.status === 'absent'));

      const task = await request('/api/tasks/T001', 'PATCH', { done: true });
      assert.equal(task.value.data.done, true);
      assert.equal(JSON.parse(await fs.readFile(path.join(temp, 'tasks.json'), 'utf8'))[0].done, true);
      assert.ok((await request('/api/subjects?classId=12A5')).value.data.length > 0);
      assert.ok((await request('/api/reports?classId=12A5')).value.data.length > 0);
      assert.ok((await request('/api/templates?classId=12A5')).value.data.length > 0);
      assert.ok((await request('/api/messages?classId=12A5')).value.data.length > 0);
      const chat = await request('/api/assistant/chat', 'POST', { prompt: 'Soạn tin nhắn phụ huynh' });
      assert.equal(chat.value.data.isRealAI, false);
      assert.ok(chat.value.data.reply.length > 20);
      assert.equal((await request('/api/missing')).status, 404);

      // Cloud sync endpoints for modern UI
      assert.equal((await request('/api/cloud/TEST_ROOM')).status, 404);
      const cloudPost = await request('/api/cloud/TEST_ROOM', 'POST', {
        data: { className: '12A5', students: [{ id: 'hs-1', name: 'Test' }] },
        role: 'teacher',
        authorName: 'GVCN Vũ Tiến',
        actionSummary: 'Khởi tạo phòng lớp học'
      });
      assert.equal(cloudPost.status, 200);
      assert.equal(cloudPost.value.success, true);
      assert.ok(cloudPost.value.activityLogs.length > 0);
      const cloudGet = await request('/api/cloud/TEST_ROOM');
      assert.equal(cloudGet.status, 200);
      assert.equal(cloudGet.value.data.className, '12A5');

      const removed = await request('/api/students/' + newId, 'DELETE');
      assert.equal(removed.status, 200);
      assert.equal((await request('/api/students?classId=12A5')).value.total, 42);
      assert.equal((await request('/api/attendance?date=2026-10-08&classId=12A5')).value.data.records.length, 42);
      console.log('PASS: static frontend, 12 API flows, validation, student CRUD, attendance, task JSON persisted, cloud sync, mock AI');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
