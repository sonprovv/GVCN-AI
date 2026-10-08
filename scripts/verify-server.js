'use strict';
process.loadEnvFile();
const http = require('node:http');
const storage = require('../backend/storage');
const { server } = require('../backend/server');

async function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

async function verify() {
  await storage.initializeStorage();
  console.log('[Storage initialized]');

  const testPort = 3456;
  await new Promise(resolve => server.listen(testPort, '127.0.0.1', resolve));
  console.log(`[Test server listening on port ${testPort}]`);

  try {
    // 1. Check index.html
    const indexRes = await get(`http://127.0.0.1:${testPort}/`);
    console.log('GET /:', indexRes.statusCode, indexRes.body.length, 'bytes');

    // 2. Check bundle
    const bundleRes = await get(`http://127.0.0.1:${testPort}/assets/index-SiniHO1L.js`);
    console.log('GET /assets/index-SiniHO1L.js:', bundleRes.statusCode, bundleRes.body.length, 'bytes');
    const hasMorning = bundleRes.body.includes('Ca Sáng');
    const hasAfternoon = bundleRes.body.includes('Ca Chiều');
    const hasSessFilter = bundleRes.body.includes('sessFilter');
    console.log('Bundle checks:', { hasMorning, hasAfternoon, hasSessFilter });

    // 3. Check cloud room API
    const roomRes = await get(`http://127.0.0.1:${testPort}/api/cloud/12A5`);
    console.log('GET /api/cloud/12A5:', roomRes.statusCode);
    const statusRes = await get(`http://127.0.0.1:${testPort}/api/cloud/12A5/status`);
    console.log('GET /api/cloud/12A5/status:', statusRes.statusCode, statusRes.body);
    const roomData = JSON.parse(roomRes.body);
    const students = roomData.data?.students || [];
    console.log(`Room 12A5 real students (${students.length}):`);
    console.log(' First:', students[0]?.stt, students[0]?.fullName, students[0]?.role, students[0]?.teamId);
    console.log(' Last :', students[students.length - 1]?.stt, students[students.length - 1]?.fullName, students[students.length - 1]?.role, students[students.length - 1]?.teamId);

    if (hasMorning && hasAfternoon && hasSessFilter && students.length === 46 && students[0]?.fullName === 'Nguyễn Thị Thái An' && statusRes.statusCode === 200) {
      console.log('>>> ALL VERIFICATION CHECKS PASSED! <<<');
    } else {
      console.error('>>> SOME CHECKS FAILED! <<<');
    }
  } finally {
    server.close();
    await storage.shutdown();
    console.log('[Test server closed]');
  }
}

verify().catch(console.error);
