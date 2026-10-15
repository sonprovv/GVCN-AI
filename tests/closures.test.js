'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { calculateWorkload, closureMatchesSession } = require('../backend/services/timetableEngine');

const teachers = [
  { code: 'GV01', fullName: 'Nguyễn Văn A', department: 'Toán' },
  { code: 'GV02', fullName: 'Trần Thị B', department: 'Văn' }
];

function session(id, overrides) {
  return {
    id,
    date: '2026-10-12',
    dayOfWeek: 2,
    sessionOfDay: 'MORNING',
    period: 1,
    classCode: '10A1',
    subjectCode: 'TOAN',
    assignedTeacherCode: 'GV01',
    sessionType: 'REGULAR',
    timetableVersionCode: 'TKB-1',
    status: 'PENDING',
    ...overrides
  };
}

test('closureMatchesSession theo buổi, khối và lớp', () => {
  const s = session('s1', { classCode: '11A3', sessionOfDay: 'AFTERNOON' });
  assert.equal(closureMatchesSession({ date: '2026-10-12', sessionOfDay: 'ALL_DAY', scope: 'SCHOOL' }, s), true);
  assert.equal(closureMatchesSession({ date: '2026-10-12', sessionOfDay: 'MORNING', scope: 'SCHOOL' }, s), false);
  assert.equal(closureMatchesSession({ date: '2026-10-13', sessionOfDay: 'ALL_DAY', scope: 'SCHOOL' }, s), false);
  assert.equal(closureMatchesSession({ date: '2026-10-12', sessionOfDay: 'AFTERNOON', scope: 'GRADE', grades: ['11'] }, s), true);
  assert.equal(closureMatchesSession({ date: '2026-10-12', sessionOfDay: 'AFTERNOON', scope: 'GRADE', grades: ['10', '12'] }, s), false);
  assert.equal(closureMatchesSession({ date: '2026-10-12', sessionOfDay: 'AFTERNOON', scope: 'CLASS', classCodes: ['11a3'] }, s), true);
  assert.equal(closureMatchesSession({ date: '2026-10-12', sessionOfDay: 'AFTERNOON', scope: 'CLASS', classCodes: ['11A1'] }, s), false);
});

test('Tiết thuộc lịch nghỉ không tính phân công/vắng/dự kiến, tính riêng closedPeriods', () => {
  const sessions = [
    session('m1', { period: 1, status: 'PENDING' }),
    session('m2', { period: 2, status: 'CANCELLED' }),
    session('m3', { period: 3, status: 'CONFIRMED', actualTeacherCode: 'GV01', actualDate: '2026-10-12' }),
    session('a1', { sessionOfDay: 'AFTERNOON', period: 1, status: 'CONFIRMED', actualTeacherCode: 'GV01', actualDate: '2026-10-12' }),
    // Tiết buổi sáng nghỉ nhưng đã được chuyển dạy bù sang ngày khác -> vẫn tính dạy bù
    session('m4', { period: 4, status: 'MAKEUP', actualTeacherCode: 'GV01', actualDate: '2026-10-14' })
  ];
  const closures = [{ id: 'c1', date: '2026-10-12', sessionOfDay: 'MORNING', scope: 'SCHOOL', reason: 'Nghỉ toàn trường' }];

  const { summary, drilldown } = calculateWorkload(teachers, sessions, [], { startDate: '2026-10-12', endDate: '2026-10-18' }, closures);
  const gv01 = summary.find(s => s.teacherCode === 'GV01');

  assert.equal(gv01.closedPeriods, 3);
  assert.equal(gv01.assignedPeriods, 2); // buổi chiều + tiết dạy bù
  assert.equal(gv01.absencePeriods, 0);
  assert.equal(gv01.pendingPeriods, 0);
  assert.equal(gv01.actualTaughtPeriods, 2);
  assert.equal(gv01.makeupPeriods, 1);
  assert.equal(drilldown.GV01.closedSessions[0].closureReason, 'Nghỉ toàn trường');

  // Không có lịch nghỉ thì giữ nguyên cách tính cũ
  const noClosure = calculateWorkload(teachers, sessions, [], { startDate: '2026-10-12', endDate: '2026-10-18' });
  const before = noClosure.summary.find(s => s.teacherCode === 'GV01');
  assert.equal(before.closedPeriods, 0);
  assert.equal(before.assignedPeriods, 5);
  assert.equal(before.absencePeriods, 1);
});

test('API lịch nghỉ: tạo, áp vào báo cáo, bulk-confirm bỏ qua, xóa', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'gvcn-closure-test-'));
  try {
    for (const file of await fs.readdir(path.join(__dirname, '../backend/data'))) {
      await fs.copyFile(path.join(__dirname, '../backend/data', file), path.join(temp, file));
    }
    await fs.writeFile(path.join(temp, 'teachers.json'), JSON.stringify(teachers));
    await fs.writeFile(path.join(temp, 'teaching_sessions.json'), JSON.stringify([
      session('k10', { classCode: '10A1', assignedTeacherCode: 'GV01' }),
      session('k12', { classCode: '12A2', assignedTeacherCode: 'GV02' })
    ]));
    process.env.GVCN_DATA_DIR = temp;
    // Để chuỗi rỗng (không xóa) để server không nạp lại DATABASE_URL thật từ .env
    process.env.DATABASE_URL = '';

    const { server } = require('../backend/server');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (pathname, method = 'GET', body) => {
      const res = await fetch(base + pathname, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      return { status: res.status, value: await res.json().catch(() => null) };
    };

    try {
      const invalid = await request('/api/timetable/closures', 'POST', { date: '2026-10-12', scope: 'GRADE', grades: [], reason: 'x' });
      assert.equal(invalid.status, 400);

      // Nghỉ buổi sáng chỉ khối 12
      const created = await request('/api/timetable/closures', 'POST', {
        date: '2026-10-12', sessionOfDay: 'MORNING', scope: 'GRADE', grades: ['12'], reason: 'Khối 12 thi thử'
      });
      assert.equal(created.status, 201);
      const closureId = created.value.data.id;

      const list = await request('/api/closures');
      assert.equal(list.value.data.length, 1);

      const sessions = await request('/api/sessions?startDate=2026-10-12&endDate=2026-10-12');
      assert.equal(sessions.value.data.find(s => s.id === 'k12').closure.reason, 'Khối 12 thi thử');
      assert.equal(sessions.value.data.find(s => s.id === 'k10').closure, undefined);

      const report = await request('/api/reports/summary?startDate=2026-10-12&endDate=2026-10-18');
      const gv01 = report.value.data.summary.find(s => s.teacherCode === 'GV01');
      const gv02 = report.value.data.summary.find(s => s.teacherCode === 'GV02');
      assert.equal(gv01.closedPeriods, 0);
      assert.equal(gv01.assignedPeriods, 1);
      assert.equal(gv02.closedPeriods, 1);
      assert.equal(gv02.assignedPeriods, 0);

      const confirm = await request('/api/sessions/bulk-confirm', 'POST', { startDate: '2026-10-12', endDate: '2026-10-12' });
      assert.equal(confirm.value.confirmedCount, 1);
      assert.equal(confirm.value.skippedClosedCount, 1);

      const removed = await request(`/api/closures/${closureId}`, 'DELETE');
      assert.equal(removed.status, 200);
      const after = await request('/api/reports/summary?startDate=2026-10-12&endDate=2026-10-18');
      assert.equal(after.value.data.summary.find(s => s.teacherCode === 'GV02').closedPeriods, 0);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
