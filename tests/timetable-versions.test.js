'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  vnDayOfWeek,
  buildClassTimeline,
  getEffectiveRange,
  describeVersions,
  buildExpectedSessions,
  planSessionSync,
  applySessionSync
} = require('../backend/services/timetableVersions');

const teachers = [
  { code: 'GV01', fullName: 'Nguyễn Văn A', aliases: ['A Toán'] },
  { code: 'GV02', fullName: 'Trần Thị B' },
  { code: 'GV03', fullName: 'Lê Văn C' }
];

// Thứ 2 (dayOfWeek 2): 10A1 tiết 1 sáng, 12A1 tiết 1 sáng
const tkbCu = {
  id: 'tt-1', code: 'TKB1', validFrom: '2026-09-07', validTo: null, isActive: true, createdAt: '2026-09-01T00:00:00Z',
  entries: [
    { classCode: '10A1', dayOfWeek: 2, sessionOfDay: 'MORNING', period: 1, subjectCode: 'Toán', teacherCode: 'A Toán' },
    { classCode: '10A1', dayOfWeek: 2, sessionOfDay: 'MORNING', period: 2, subjectCode: 'Lý', teacherCode: 'GV02' },
    { classCode: '12A1', dayOfWeek: 2, sessionOfDay: 'MORNING', period: 1, subjectCode: 'Văn', teacherCode: 'GV02' },
    { classCode: 'Khối', dayOfWeek: 2, sessionOfDay: 'MORNING', period: 1, subjectCode: 'Trực', teacherCode: 'GV03' }
  ]
};
// TKB mới chỉ cho khối 10, có hiệu lực từ 2026-10-05: 10A1 tiết 1 đổi sang GV03, bỏ tiết 2
const tkbMoiKhoi10 = {
  id: 'tt-2', code: 'TKB2', validFrom: '2026-10-05', validTo: null, isActive: true, createdAt: '2026-10-01T00:00:00Z',
  entries: [
    { classCode: '10A1', dayOfWeek: 2, sessionOfDay: 'MORNING', period: 1, subjectCode: 'Toán', teacherCode: 'GV03' }
  ]
};

test('vnDayOfWeek theo cách gọi Việt Nam', () => {
  assert.equal(vnDayOfWeek('2026-10-12'), 2); // Thứ Hai
  assert.equal(vnDayOfWeek('2026-10-17'), 7); // Thứ Bảy
  assert.equal(vnDayOfWeek('2026-10-18'), 8); // Chủ nhật
});

test('TKB mới thay TKB cũ theo từng lớp, tự suy ra ngày kết thúc', () => {
  const timeline = buildClassTimeline([tkbMoiKhoi10, tkbCu]);
  assert.equal(getEffectiveRange(timeline, '10A1', '2026-10-04').version.code, 'TKB1');
  assert.equal(getEffectiveRange(timeline, '10A1', '2026-10-05').version.code, 'TKB2');
  // Khối 12 không có trong TKB mới -> vẫn dùng TKB cũ
  assert.equal(getEffectiveRange(timeline, '12A1', '2026-10-20').version.code, 'TKB1');
  assert.equal(getEffectiveRange(timeline, '10A1', '2026-09-01'), null);
  assert.equal(timeline.has('KHỐI'), false);

  const described = describeVersions([tkbMoiKhoi10, tkbCu], '2026-10-12');
  const cu = described.find(v => v.code === 'TKB1');
  const moi = described.find(v => v.code === 'TKB2');
  assert.equal(cu.status, 'PARTIAL');
  assert.equal(cu.effectiveTo, null); // khối 12 vẫn đang dùng
  assert.deepEqual(cu.replacedBy, ['TKB2']);
  assert.equal(moi.status, 'ACTIVE');

  // Khi TKB mới phủ hết các lớp -> TKB cũ kết thúc ngày trước đó
  const tkbMoiToanTruong = { ...tkbMoiKhoi10, id: 'tt-3', code: 'TKB3', entries: [...tkbMoiKhoi10.entries, { ...tkbCu.entries[2] }] };
  const all = describeVersions([tkbMoiToanTruong, tkbCu], '2026-10-12');
  assert.equal(all.find(v => v.code === 'TKB1').status, 'REPLACED');
  assert.equal(all.find(v => v.code === 'TKB1').effectiveTo, '2026-10-04');

  // Cùng ngày bắt đầu: phiên bản tạo sau được dùng
  const trungNgay = { ...tkbMoiKhoi10, id: 'tt-4', code: 'TKB4', validFrom: '2026-10-05', createdAt: '2026-10-02T00:00:00Z' };
  const t2 = buildClassTimeline([trungNgay, tkbMoiKhoi10, tkbCu]);
  assert.equal(getEffectiveRange(t2, '10A1', '2026-10-05').version.code, 'TKB4');
});

test('Sinh tiết học: giữ tiết đã xác nhận, tạo lại tiết chưa xác nhận theo TKB mới', () => {
  // Trước khi có TKB mới: sinh tuần 05/10 theo TKB cũ
  const before = buildExpectedSessions([tkbCu], teachers, '2026-10-05', '2026-10-11');
  assert.equal(before.expected.length, 3);
  assert.equal(before.stats.invalidClassEntries, 1);
  assert.equal(before.expected.find(s => s.classCode === '10A1' && s.period === 1).assignedTeacherCode, 'GV01');

  let sessions = applySessionSync([], planSessionSync([], before.expected, '2026-10-05', '2026-10-11'));
  assert.equal(sessions.length, 3);
  // Tiết 10A1 tiết 2 đã được xác nhận trước khi có TKB mới
  sessions = sessions.map(s => (s.classCode === '10A1' && s.period === 2
    ? { ...s, status: 'CONFIRMED', actualTeacherCode: 'GV02', actualDate: s.date }
    : s));

  // Có TKB mới cho khối 10 từ 05/10
  const after = buildExpectedSessions([tkbMoiKhoi10, tkbCu], teachers, '2026-10-05', '2026-10-11');
  const plan = planSessionSync(sessions, after.expected, '2026-10-05', '2026-10-11');
  assert.equal(plan.toUpdate.size, 1);   // 10A1 tiết 1: GV01 -> GV03
  assert.equal(plan.toRemove.size, 0);
  assert.equal(plan.kept, 1);           // 10A1 tiết 2 đã xác nhận, giữ nguyên
  assert.equal(plan.unchanged, 1);      // 12A1 không đổi
  assert.equal(plan.toAdd.length, 0);

  const synced = applySessionSync(sessions, plan);
  const t1 = synced.find(s => s.classCode === '10A1' && s.period === 1);
  assert.equal(t1.assignedTeacherCode, 'GV03');
  assert.equal(t1.timetableVersionCode, 'TKB2');
  assert.equal(t1.id, sessions.find(s => s.classCode === '10A1' && s.period === 1).id); // giữ id cũ
  assert.equal(synced.find(s => s.classCode === '10A1' && s.period === 2).status, 'CONFIRMED');

  // Nếu tiết 2 còn PENDING thì bị xóa vì TKB mới không còn tiết đó
  const pendingOnly = sessions.map(s => ({ ...s, status: 'PENDING' }));
  const plan2 = planSessionSync(pendingOnly, after.expected, '2026-10-05', '2026-10-11');
  assert.equal(plan2.toRemove.size, 1);

  // Chạy lại lần nữa không đổi gì (idempotent)
  const plan3 = planSessionSync(synced, after.expected, '2026-10-05', '2026-10-11');
  assert.equal(plan3.toAdd.length + plan3.toUpdate.size + plan3.toRemove.size, 0);
});

test('API: sinh tiết học, tạo TKB mới tự tạo lại tiết chưa xác nhận', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'gvcn-tkb-version-test-'));
  try {
    for (const file of await fs.readdir(path.join(__dirname, '../backend/data'))) {
      await fs.copyFile(path.join(__dirname, '../backend/data', file), path.join(temp, file));
    }
    await fs.writeFile(path.join(temp, 'teachers.json'), JSON.stringify(teachers));
    await fs.writeFile(path.join(temp, 'timetables.json'), JSON.stringify([tkbCu]));
    await fs.writeFile(path.join(temp, 'teaching_sessions.json'), '[]');
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
      const tooLong = await request('/api/timetables/generate-sessions', 'POST', { startDate: '2026-09-01', endDate: '2026-12-31' });
      assert.equal(tooLong.status, 400);

      const preview = await request('/api/timetables/generate-sessions', 'POST', { startDate: '2026-10-05', endDate: '2026-10-18', dryRun: true });
      assert.equal(preview.value.data.created, 6);
      assert.equal((await request('/api/sessions?startDate=2026-10-05&endDate=2026-10-18')).value.data.length, 0);

      const gen = await request('/api/timetables/generate-sessions', 'POST', { startDate: '2026-10-05', endDate: '2026-10-18' });
      assert.equal(gen.value.data.created, 6);

      // Xác nhận tuần đầu
      await request('/api/sessions/bulk-confirm', 'POST', { startDate: '2026-10-05', endDate: '2026-10-11' });

      // Tạo TKB mới cho khối 10 từ 05/10 -> tuần đầu (đã xác nhận) giữ nguyên, tuần sau được tạo lại
      const created = await request('/api/timetables', 'POST', {
        code: 'TKB2', name: 'TKB mới khối 10', validFrom: '2026-10-05', entries: tkbMoiKhoi10.entries
      });
      assert.equal(created.status, 201);
      assert.equal(created.value.regenerated.keptConfirmed, 3);
      assert.equal(created.value.regenerated.updated, 1);
      assert.equal(created.value.regenerated.removed, 1);
      assert.equal(created.value.regenerated.conflictCount, 2);

      const week2 = (await request('/api/sessions?startDate=2026-10-12&endDate=2026-10-18')).value.data;
      assert.equal(week2.length, 2);
      assert.equal(week2.find(s => s.classCode === '10A1').assignedTeacherCode, 'GV03');

      const list = await request('/api/timetables?today=2026-10-12');
      assert.equal(list.value.data.find(v => v.code === 'TKB1').status, 'PARTIAL');
      assert.equal(list.value.data.find(v => v.code === 'TKB2').status, 'ACTIVE');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
