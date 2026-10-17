'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { suggestTeacherSubjects } = require('../backend/services/teacherSubjects');

// Dữ liệu đang sai giống thực tế: môn/tổ bị đoán từ tên viết tắt
const teachers = [
  { id: 't1', code: 'GV01', fullName: 'Nguyễn Quang Vinh', aliases: ['Vinh'], department: 'Ngữ văn', subject: 'Ngữ văn' },
  { id: 't2', code: 'GV03', fullName: 'Trần Văn Sử', aliases: ['Sử'], department: 'Sinh học', subject: 'Sinh học' },
  { id: 't3', code: 'GV47', fullName: 'Phạm Trà Giang', aliases: ['GiangA'], department: 'Ngoại ngữ', subject: 'Ngoại ngữ' },
  { id: 't4', code: 'GV76', fullName: 'Nguyễn Tuấn Anh', aliases: ['Tuấn Anh'], department: 'Hóa học', subject: 'Hóa học' },
  { id: 't5', code: 'GV04', fullName: 'Đặng Kiều Anh', aliases: ['Anh'], department: 'Hóa học', subject: 'Hóa học' }
];

const E = (classCode, period, subject, teacherCode, dayOfWeek = 2) =>
  ({ classCode, dayOfWeek, sessionOfDay: 'MORNING', period, subject, subjectCode: subject, teacherCode });

const versions = [{
  id: 'tt-1', code: 'TKB1', validFrom: '2026-09-07', isActive: true,
  entries: [
    E('10A1', 1, 'Toán', 'Vinh'), E('10A2', 2, 'Toán', 'GV01'), E('10A1', 5, 'SHL', 'GV01'),
    E('11A1', 1, 'Toán', 'GV03'),
    E('12A1', 1, 'NNgữ', 'GV47'), E('12A2', 2, 'NNgữ', 'GV47'),
    E('10A3', 1, 'GDTC', 'GV76'), E('10A4', 2, 'GDTC', 'GV76'), E('10A5', 3, 'Toán', 'GV76'),
    E('Khối', 1, 'Trực', 'GV04')
  ]
}];

test('Suy ra môn & tổ từ TKB, bỏ qua SHL, đánh dấu dạy nhiều môn', () => {
  const r = Object.fromEntries(suggestTeacherSubjects(teachers, versions, '2026-10-12').map(x => [x.code, x]));

  assert.deepEqual(r.GV01.suggested, { subject: 'Toán', department: 'Toán - Tin' });
  assert.equal(r.GV01.subjects.length, 1); // SHL không tính là môn
  assert.equal(r.GV01.changed, true);
  assert.deepEqual(r.GV03.suggested, { subject: 'Toán', department: 'Toán - Tin' });
  assert.deepEqual(r.GV47.suggested, { subject: 'Ngoại ngữ', department: 'Ngoại ngữ' });
  assert.equal(r.GV47.changed, false);
  assert.equal(r.GV76.suggested.subject, 'GDTC');
  assert.equal(r.GV76.suggested.department, 'Thể dục - GDQP');
  assert.equal(r.GV76.mixed, true);
  // Không có tiết hợp lệ trong TKB (lớp "Khối" bị bỏ qua) -> không gợi ý
  assert.equal(r.GV04.suggested, null);
  assert.equal(r.GV04.changed, false);
});

test('API: xem gợi ý, áp dụng cho mã được chọn, sửa một giáo viên', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'gvcn-teacher-subject-test-'));
  try {
    for (const file of await fs.readdir(path.join(__dirname, '../backend/data'))) {
      await fs.copyFile(path.join(__dirname, '../backend/data', file), path.join(temp, file));
    }
    await fs.writeFile(path.join(temp, 'teachers.json'), JSON.stringify(teachers));
    await fs.writeFile(path.join(temp, 'timetables.json'), JSON.stringify(versions));
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
      const sug = await request('/api/teachers/subject-suggestions');
      assert.equal(sug.value.data.filter(x => x.changed).length, 3);

      assert.equal((await request('/api/teachers/apply-subjects', 'POST', { codes: [] })).status, 400);
      const applied = await request('/api/teachers/apply-subjects', 'POST', { codes: ['GV01', 'gv03', 'GV04'] });
      assert.equal(applied.value.updated, 2); // GV04 không có gợi ý nên bỏ qua

      let list = (await request('/api/teachers')).value.data;
      assert.equal(list.find(t => t.code === 'GV01').subject, 'Toán');
      assert.equal(list.find(t => t.code === 'GV01').department, 'Toán - Tin');
      assert.equal(list.find(t => t.code === 'GV76').subject, 'Hóa học'); // không chọn -> giữ nguyên

      const bad = await request('/api/teachers/GV76', 'PATCH', { homeroomClass: 'lớp 10' });
      assert.equal(bad.status, 400);
      const patched = await request('/api/teachers/GV76', 'PATCH', {
        subject: 'GDTC', department: 'Thể dục - GDQP', homeroomClass: '10a3', aliases: 'Tuấn Anh, TA TD'
      });
      assert.equal(patched.status, 200);
      assert.equal(patched.value.data.homeroomClass, '10A3');
      assert.deepEqual(patched.value.data.aliases, ['Tuấn Anh', 'TA TD']);
      assert.equal(patched.value.data.fullName, 'Nguyễn Tuấn Anh');

      list = (await request('/api/teachers')).value.data;
      assert.equal(list.find(t => t.code === 'GV76').department, 'Thể dục - GDQP');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
