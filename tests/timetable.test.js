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

    const { server } = require('../backend/server');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    const request = async (pathname, method = 'GET', body, headers = {}) => {
      const h = { ...headers };
      if (body !== undefined) h['content-type'] = 'application/json';
      const res = await fetch(base + pathname, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      let json = null;
      try { json = await res.json(); } catch {}
      return { status: res.status, headers: res.headers, value: json };
    };

    try {
      // 1. Kiểm tra CORS Preflight OPTIONS cho Web Vercel
      const corsRes = await fetch(base + '/api/teachers', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://tkb-gv.vercel.app',
          'Access-Control-Request-Method': 'POST'
        }
      });
      assert.equal(corsRes.status, 204);
      assert.equal(corsRes.headers.get('access-control-allow-origin'), 'https://tkb-gv.vercel.app');
      assert.match(corsRes.headers.get('access-control-allow-methods'), /GET, POST/);

      // 2. GET /api/teachers
      const getTeachers = await request('/api/teachers');
      console.log('getTeachers:', JSON.stringify(getTeachers.value));
      assert.equal(getTeachers.status, 200);
      assert.equal(getTeachers.value.success, true);
      assert.ok(getTeachers.value.data.length >= 5);
      const gvA = getTeachers.value.data.find(t => t.code === 'GV01');
      assert.ok(gvA);
      assert.equal(gvA.fullName, 'Nguyễn Văn A');
      assert.ok(gvA.aliases.includes('A Toán'));

      // 3. TC-01: Chặn trùng mã giáo viên khi import
      const dupImport = await request('/api/teachers/import', 'POST', {
        rows: [
          { code: 'GV01', fullName: 'Trùng mã GV01' }
        ]
      });
      assert.equal(dupImport.status, 400);
      assert.equal(dupImport.value.success, false);
      assert.match(dupImport.value.error, /đã tồn tại/);

      // 4. TC-04, TC-05, TC-08: Thống kê tuần 05/10/2026 -> 11/10/2026
      // GV01 có 20 phân công, 2 nghỉ, 1 thay = 19 thực dạy
      // 1 tiết sinh hoạt lớp, 2 lượt trực
      const summaryRes = await request('/api/timetable/reports/summary?startDate=2026-10-05&endDate=2026-10-11');
      assert.equal(summaryRes.status, 200);
      assert.equal(summaryRes.value.success, true);

      const summaryList = summaryRes.value.data.summary;
      const sumGV01 = summaryList.find(s => s.teacherCode === 'GV01');
      assert.ok(sumGV01);
      assert.equal(sumGV01.assignedPeriods, 20);
      assert.equal(sumGV01.actualTaughtPeriods, 19); // 20 - 2 + 1 = 19
      assert.equal(sumGV01.absencePeriods, 2);
      assert.equal(sumGV01.substituteGivenPeriods, 1);
      assert.equal(sumGV01.homeroomPeriods, 1); // SHL tách riêng
      assert.equal(sumGV01.dutyCount, 2);       // Trực trường tách riêng

      // TC-05: GV02 bị dạy thay -> thực dạy = 0, nghỉ = 1
      const sumGV02 = summaryList.find(s => s.teacherCode === 'GV02');
      assert.ok(sumGV02);
      assert.equal(sumGV02.actualTaughtPeriods, 0);
      assert.equal(sumGV02.absencePeriods, 1);

      // 5. TC-06: Dạy bù chuyển sang tháng 11
      const novRes = await request('/api/timetable/reports/summary?startDate=2026-11-01&endDate=2026-11-30');
      assert.equal(novRes.status, 200);
      const sumGV01Nov = novRes.value.data.summary.find(s => s.teacherCode === 'GV01');
      assert.ok(sumGV01Nov);
      assert.equal(sumGV01Nov.actualTaughtPeriods, 1);
      assert.equal(sumGV01Nov.makeupPeriods, 1);

      // 6. TC-12: Drilldown truy vết danh sách tiết
      const drillA = summaryRes.value.data.drilldown['GV01'];
      assert.ok(drillA);
      assert.equal(drillA.actualTaughtSessions.length, 19);
      assert.equal(drillA.absenceSessions.length, 2);
      assert.equal(drillA.duties.length, 2);

      // 7. GET /api/timetables
      const getTkb = await request('/api/timetables');
      assert.equal(getTkb.status, 200);
      assert.ok(getTkb.value.data.length >= 2);

      // 8. GET /api/timetable/duties
      const getDuties = await request('/api/timetable/duties');
      assert.equal(getDuties.status, 200);
      assert.ok(getDuties.value.data.length >= 2);

    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
});
