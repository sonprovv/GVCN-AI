'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('Timetable API + Calculation Engine on Botkeep backend', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'gvcn-tkb-test-'));
  try {
    for (const file of await fs.readdir(path.join(__dirname, '../backend/data'))) {
      await fs.copyFile(path.join(__dirname, '../backend/data', file), path.join(temp, file));
    }
    process.env.GVCN_DATA_DIR = temp;
    // Chạy chế độ file cục bộ để cô lập test
    // Để chuỗi rỗng (không xóa) để server không nạp lại DATABASE_URL thật từ .env
    process.env.DATABASE_URL = '';

    const { server } = require('../backend/server');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    const request = async (pathname, method = 'GET', body, headers = {}) => {
      const h = { ...headers };
      if (body !== undefined) h['content-type'] = 'application/json';
      const res = await fetch(base + pathname, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      let json = null;
      try { json = await res.json(); } catch {}
      return { status: res.status, headers: res.headers, value: json, text: async () => res.text() };
    };

    try {
      // 1. Kiểm tra CORS Preflight OPTIONS cho Web Vercel
      const corsRes = await fetch(base + '/api/teachers', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://tkb-gv-9vix-jet.vercel.app',
          'Access-Control-Request-Method': 'POST'
        }
      });
      assert.equal(corsRes.status, 204);
      assert.equal(corsRes.headers.get('access-control-allow-origin'), 'https://tkb-gv-9vix-jet.vercel.app');
      assert.match(corsRes.headers.get('access-control-allow-methods'), /GET, POST/);

      // 2. Health check endpoint
      const healthRes = await request('/api/timetable/health');
      assert.equal(healthRes.status, 200);
      assert.equal(healthRes.value.success, true);

      // 3. Thêm giáo viên mới qua /api/teachers hoặc /api/timetable/teachers
      const addTeacher = await request('/api/timetable/teachers', 'POST', {
        code: 'GV_TEST_01',
        fullName: 'Nguyễn Văn Test',
        department: 'Toán',
        aliases: ['Test Toán']
      });
      assert.equal(addTeacher.status, 201);
      assert.equal(addTeacher.value.success, true);
      assert.equal(addTeacher.value.data.code, 'GV_TEST_01');

      // 4. Lấy danh sách giáo viên qua /api/timetable/teachers (không bị 401)
      const getTeachersPrefixed = await request('/api/timetable/teachers');
      assert.equal(getTeachersPrefixed.status, 200);
      assert.equal(getTeachersPrefixed.value.success, true);
      assert.ok(Array.isArray(getTeachersPrefixed.value.data));
      const found = getTeachersPrefixed.value.data.find(t => t.code === 'GV_TEST_01');
      assert.ok(found);

      // 5. Lấy danh sách giáo viên qua /api/teachers (gọi trực tiếp)
      const getTeachersDirect = await request('/api/teachers');
      assert.equal(getTeachersDirect.status, 200);
      assert.equal(getTeachersDirect.value.success, true);

      // 6. TC-01: Chặn trùng mã giáo viên khi import
      const dupImport = await request('/api/timetable/teachers/import', 'POST', {
        rows: [
          { code: 'GV_TEST_01', fullName: 'Trùng mã' }
        ]
      });
      assert.equal(dupImport.status, 400);
      assert.equal(dupImport.value.success, false);
      assert.match(dupImport.value.error, /đã tồn tại/);

      // 7. GET /api/timetable/timetables
      const getTkb = await request('/api/timetable/timetables');
      assert.equal(getTkb.status, 200);
      assert.equal(getTkb.value.success, true);

      // 8. GET /api/timetable/reports/summary
      const summaryRes = await request('/api/timetable/reports/summary?startDate=2026-10-05&endDate=2026-10-11');
      assert.equal(summaryRes.status, 200);
      assert.equal(summaryRes.value.success, true);
      assert.ok(summaryRes.value.data.summary);

      // 9. GET /api/timetable/reports/export (Xuất file CSV UTF-8)
      const exportRes = await fetch(base + '/api/timetable/reports/export?startDate=2026-10-05&endDate=2026-10-11');
      assert.equal(exportRes.status, 200);
      assert.match(exportRes.headers.get('content-type'), /text\/csv/);
      const csvText = await exportRes.text();
      assert.ok(csvText.includes('Mã GV'));

    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
});
