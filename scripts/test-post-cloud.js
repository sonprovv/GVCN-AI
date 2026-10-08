'use strict';
process.loadEnvFile();
const http = require('node:http');
const { server } = require('../backend/server');
const storage = require('../backend/storage');

async function testPost() {
  await storage.initializeStorage();
  const testPort = 3457;
  await new Promise(resolve => server.listen(testPort, '127.0.0.1', resolve));

  try {
    const postData = JSON.stringify({
      data: {
        settings: { schoolName: 'THPT VŨ TIÊN', className: '12A5', teacherName: 'GVCN Vũ Tiến' },
        teams: [
          { id: 'team-1', name: 'Tổ 1', color: 'blue', directPoints: 0, createdAt: '2026-09-01' },
          { id: 'team-2', name: 'Tổ 2', color: 'emerald', directPoints: 0, createdAt: '2026-09-01' }
        ],
        students: [
          { id: 'hs-01', stt: 1, fullName: 'Nguyễn Thị Thái An', gender: 'Nữ', teamId: 'team-1', role: 'Lớp trưởng' },
          { id: 'hs-02', stt: 2, fullName: 'Trần Hoàng Nam', gender: 'Nam', teamId: 'team-1', role: 'Thành viên' }
        ]
      },
      role: 'teacher',
      authorName: 'GVCN Vũ Tiến',
      actionSummary: 'Thử nghiệm import Excel thay thế 2 học sinh'
    });

    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: testPort,
        path: '/api/cloud/12A5',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    console.log('POST /api/cloud/12A5 response:', res.statusCode, res.body);

    // Verify GET
    const getRes = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}/api/cloud/12A5`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }).on('error', reject);
    });

    console.log('GET /api/cloud/12A5 response:', getRes.statusCode);
    const parsed = JSON.parse(getRes.body);
    console.log('Students in room 12A5 after POST:', parsed.data?.students?.length);
    console.log('Activity log:', parsed.activityLogs?.[0]);

  } finally {
    server.close();
    await storage.shutdown();
  }
}

testPost().catch(console.error);
