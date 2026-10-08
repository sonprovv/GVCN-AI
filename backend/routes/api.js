'use strict';
const { readJson, updateJson, mode, health } = require('../storage');
const { handleAuth, ensureAccess } = require('../auth');
const { STATUSES, VALID_STUDENT_STATUSES, today, validDate, studentsFor, attendanceFor, dashboardFor } = require('../services/school');

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
function fail(status, message) { throw new ApiError(status, message); }
function respond(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function bodyJson(req) {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { fail(400, 'JSON không hợp lệ'); }
    }
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) fail(415, 'Content-Type phải là application/json');
  let size = 0, raw = '';
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) fail(413, 'Yêu cầu quá lớn');
    raw += chunk;
  }
  try { const v = JSON.parse(raw); if (!v || typeof v !== 'object' || Array.isArray(v)) fail(400, 'JSON phải là object'); return v; }
  catch (e) { if (e instanceof ApiError) throw e; fail(400, 'JSON không hợp lệ'); }
}
function assertString(value, key, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `${key} không hợp lệ`);
  return value.trim();
}
function validScore(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10; }
function validRate(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100; }
function validateStudent(data, existing = null) {
  const allowed = ['name', 'gender', 'averageScore', 'attendanceRate', 'status'];
  const input = { ...(existing || {}) };
  for (const k of allowed) if (Object.hasOwn(data, k)) input[k] = data[k];
  if (!existing && allowed.some(k => !Object.hasOwn(data, k))) fail(400, 'Thiếu trường thông tin học sinh');
  if (existing && !allowed.some(k => Object.hasOwn(data, k))) fail(400, 'Không có trường có thể cập nhật');
  input.name = assertString(input.name, 'Tên học sinh', 100);
  if (!['Nam', 'Nữ', 'Khác'].includes(input.gender)) fail(400, 'Giới tính không hợp lệ');
  if (!validScore(input.averageScore)) fail(400, 'Điểm TB phải từ 0 đến 10');
  if (!validRate(input.attendanceRate)) fail(400, 'Chuyên cần phải từ 0 đến 100');
  if (!VALID_STUDENT_STATUSES.includes(input.status)) fail(400, 'Trạng thái không hợp lệ');
  return input;
}
async function classIdFrom(url) {
  const classes = await readJson('classes');
  const classId = url.searchParams.get('classId') || classes[0]?.id;
  if (!classes.some(c => c.id === classId)) fail(400, 'Lớp học không hợp lệ');
  return classId;
}
function segment(pathname) { try { return decodeURIComponent(pathname).split('/').filter(Boolean); } catch { fail(400, 'Đường dẫn không hợp lệ'); } }
async function routeApi(req, res, url) {
  try {
    if (await handleAuth(req, res, url)) return;
    const method = req.method;
    const parts = segment(url.pathname);
    const resource = parts[1];
    if (parts.length === 2 && method === 'GET' && resource === 'health') {
      try { await health(); return respond(res, 200, { ok: true, storage: mode, version: '2.0.0' }); }
      catch { return respond(res, 503, { ok: false, storage: mode }); }
    }
    if (parts.length === 3 && resource === 'cloud') {
      const code = decodeURIComponent(parts[2]).trim().toUpperCase();
      if (!code) fail(400, 'Mã lớp không hợp lệ');
      if (method === 'GET') {
        const rooms = await readJson('cloud_rooms').catch(() => ({}));
        const room = rooms[code];
        if (!room || !room.data) {
          return respond(res, 404, { success: false, message: 'Chưa tìm thấy phòng lớp học trên đám mây' });
        }
        return respond(res, 200, {
          success: true,
          data: room.data,
          metadata: { updatedAt: room.updatedAt || new Date().toISOString() },
          activityLogs: room.activityLogs || []
        });
      }
      if (method === 'POST') {
        const body = await bodyJson(req);
        if (!body || !body.data) fail(400, 'Thiếu dữ liệu lớp học');
        const now = new Date().toISOString();
        const role = body.role === 'monitor' ? 'monitor' : 'teacher';
        const author = typeof body.authorName === 'string' && body.authorName.trim() ? body.authorName.trim().slice(0, 100) : (role === 'monitor' ? 'Lớp trưởng' : 'GVCN');
        const actionSummary = typeof body.actionSummary === 'string' && body.actionSummary.trim() ? body.actionSummary.trim().slice(0, 200) : 'Cập nhật dữ liệu lớp';

        const newLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          role,
          author,
          summary: actionSummary
        };

        const updated = await updateJson('cloud_rooms', (rooms = {}) => {
          if (!rooms || typeof rooms !== 'object' || Array.isArray(rooms)) rooms = {};
          const room = rooms[code] || { data: null, activityLogs: [], updatedAt: now };
          const logs = [newLog, ...(room.activityLogs || [])].slice(0, 50);
          rooms[code] = {
            data: body.data,
            activityLogs: logs,
            updatedAt: now
          };
          return { data: rooms, result: { updatedAt: now, activityLogs: logs } };
        });

        return respond(res, 200, {
          success: true,
          updatedAt: updated.updatedAt,
          activityLogs: updated.activityLogs
        });
      }
      fail(405, 'Phương thức không được hỗ trợ');
    }
    // Network debug — no auth required, helps diagnose DB connectivity from inside container.
    if (parts.length === 2 && method === 'GET' && resource === 'netinfo') {
      const fsSync = require('node:fs');
      const os = require('node:os');
      const info = { hostname: os.hostname(), interfaces: os.networkInterfaces(), dbError: null };
      try { info.hosts = fsSync.readFileSync('/etc/hosts', 'utf8'); } catch {}
      try { info.route = fsSync.readFileSync('/proc/net/route', 'utf8'); } catch {}
      try {
        const { execSync } = require('node:child_process');
        info.ss = execSync('ss -tnp 2>/dev/null || netstat -tnp 2>/dev/null', { timeout: 3000 }).toString();
      } catch {}
      return respond(res, 200, info);
    }
    if (!ensureAccess(req, res)) return;
    if (parts.length === 2 && method === 'GET' && resource === 'classes') return respond(res, 200, { data: await readJson('classes') });
    if (parts.length === 2 && method === 'GET' && resource === 'dashboard') {
      const date = url.searchParams.get('date') || today();
      if (!validDate(date)) fail(400, 'Ngày phải có định dạng YYYY-MM-DD');
      return respond(res, 200, { data: await dashboardFor(await classIdFrom(url), date) });
    }
    if (parts.length === 2 && method === 'GET' && resource === 'students') {
      const classId = await classIdFrom(url);
      const q = (url.searchParams.get('q') || '').toLocaleLowerCase('vi').trim();
      const status = url.searchParams.get('status') || '';
      let rows = await studentsFor(classId);
      if (q) rows = rows.filter(s => (s.name + ' ' + s.id).toLocaleLowerCase('vi').includes(q));
      if (status) rows = rows.filter(s => s.status === status);
      return respond(res, 200, { data: rows, total: rows.length });
    }
    if (parts.length === 2 && method === 'POST' && resource === 'students') {
      const body = await bodyJson(req);
      const classes = await readJson('classes');
      const classId = assertString(body.classId, 'Lớp');
      if (!classes.some(c => c.id === classId)) fail(400, 'Lớp học không hợp lệ');
      const clean = validateStudent(body);
      const created = await updateJson('students', rows => {
        const prefix = `HS${classId}-`;
        const max = rows.filter(s => s.id.startsWith(prefix)).reduce((m, s) => Math.max(m, Number(s.id.slice(prefix.length)) || 0), 0);
        const id = `${prefix}${String(max + 1).padStart(2, '0')}`;
        const entry = { id, classId, ...clean };
        rows.push(entry);
        return { data: rows, result: entry };
      });
      return respond(res, 201, { data: created });
    }
    if (parts.length === 3 && resource === 'students' && ['PATCH','DELETE'].includes(method)) {
      const id = assertString(parts[2], 'ID học sinh', 64);
      if (method === 'PATCH') {
        const patch = await bodyJson(req);
        const updated = await updateJson('students', rows => {
          const index = rows.findIndex(s => s.id === id);
          if (index < 0) fail(404, 'Không tìm thấy học sinh');
          rows[index] = validateStudent(patch, rows[index]);
          return { data: rows, result: rows[index] };
        });
        return respond(res, 200, { data: updated });
      }
      const removed = await updateJson('students', rows => {
        const index = rows.findIndex(s => s.id === id);
        if (index < 0) fail(404, 'Không tìm thấy học sinh');
        const [student] = rows.splice(index, 1);
        return { data: rows, result: student };
      });
      await updateJson('attendance', data => {
        for (const session of data.sessions) session.records = session.records.filter(r => r.studentId !== id);
        return { data, result: true };
      });
      return respond(res, 200, { data: removed });
    }
    if (parts.length === 2 && method === 'GET' && resource === 'attendance') {
      const date = url.searchParams.get('date') || today();
      if (!validDate(date)) fail(400, 'Ngày phải có định dạng YYYY-MM-DD');
      return respond(res, 200, { data: await attendanceFor(await classIdFrom(url), date) });
    }
    if (parts.length === 3 && method === 'PUT' && resource === 'attendance') {
      const date = parts[2];
      if (!validDate(date)) fail(400, 'Ngày phải có định dạng YYYY-MM-DD');
      const body = await bodyJson(req);
      const classes = await readJson('classes');
      if (!classes.some(c => c.id === body.classId)) fail(400, 'Lớp học không hợp lệ');
      const students = await studentsFor(body.classId);
      if (!Array.isArray(body.records) || body.records.length !== students.length) fail(400, 'Cần gửi đầy đủ danh sách học sinh trong lớp');
      const ids = new Set(students.map(s => s.id)), encountered = new Set();
      for (const record of body.records) {
        if (!record || !ids.has(record.studentId) || encountered.has(record.studentId) || !STATUSES.includes(record.status)) fail(400, 'Bản ghi điểm danh không hợp lệ');
        encountered.add(record.studentId);
      }
      await updateJson('attendance', data => {
        const next = { date, classId: body.classId, records: body.records.map(r => ({ studentId: r.studentId, status: r.status })) };
        const index = data.sessions.findIndex(s => s.date === date && s.classId === body.classId);
        if (index < 0) data.sessions.push(next); else data.sessions[index] = next;
        return { data, result: next };
      });
      return respond(res, 200, { data: await attendanceFor(body.classId, date), message: 'Đã lưu điểm danh lên máy chủ' });
    }
    for (const table of ['subjects', 'templates', 'reports', 'messages']) {
      if (parts.length === 2 && method === 'GET' && resource === table) {
        const items = await readJson(table);
        const classId = await classIdFrom(url);
        return respond(res, 200, { data: items.filter(x => !x.classId || x.classId === classId) });
      }
    }
    if (parts.length === 2 && method === 'GET' && resource === 'tasks') {
      const classId = await classIdFrom(url);
      return respond(res, 200, { data: (await readJson('tasks')).filter(t => t.classId === classId) });
    }
    if (parts.length === 3 && method === 'PATCH' && resource === 'tasks') {
      const id = assertString(parts[2], 'ID công việc', 64);
      const body = await bodyJson(req);
      if (typeof body.done !== 'boolean') fail(400, 'done phải là boolean');
      const updated = await updateJson('tasks', tasks => {
        const task = tasks.find(t => t.id === id);
        if (!task) fail(404, 'Không tìm thấy công việc');
        task.done = body.done;
        return { data: tasks, result: task };
      });
      return respond(res, 200, { data: updated });
    }
    if (parts.length === 3 && method === 'POST' && resource === 'assistant' && parts[2] === 'chat') {
      const input = await bodyJson(req);
      const prompt = assertString(input.prompt, 'Nội dung', 2000).toLowerCase();
      let reply = 'Tôi đã nhận yêu cầu. Đây là chế độ AI mô phỏng; chưa tích hợp model hay gửi dữ liệu tới dịch vụ bên ngoài.';
      if (/phụ huynh|tin nhắn|thông báo/.test(prompt)) reply = 'Kính gửi Quý Phụ huynh, giáo viên chủ nhiệm xin trao đổi một số nội dung liên quan tới hoạt động của lớp. Kính mong gia đình phối hợp, đồng hành cùng học sinh. Trân trọng cảm ơn!';
      else if (/nhận xét/.test(prompt)) reply = 'Học sinh đã có cố gắng trong học tập. Cần duy trì nề nếp, chuyên cần và ôn tập đều đặn. Giáo viên và gia đình có thể phối hợp động viên để em tiến bộ.';
      else if (/báo cáo/.test(prompt)) reply = 'Gợi ý báo cáo: 1. Tình hình sĩ số và chuyên cần; 2. Kết quả học tập; 3. Công tác phối hợp phụ huynh; 4. Các trường hợp cần hỗ trợ; 5. Kế hoạch tuần tới.';
      else if (/sinh hoạt/.test(prompt)) reply = 'Gợi ý tiết sinh hoạt 45 phút: 5 phút khởi động, 10 phút nhìn lại tuần, 15 phút thảo luận nhóm, 10 phút chia sẻ, 5 phút cam kết hành động.';
      return respond(res, 200, { data: { reply, provider: 'mock', isRealAI: false } });
    }
    return fail(404, 'API không tồn tại');
  } catch (error) {
    if (!(error instanceof ApiError)) console.error('API error:', error);
    return respond(res, error.status || 500, { error: { code: error.status || 500, message: error.status ? error.message : 'Lỗi máy chủ' } });
  }
}
module.exports = { routeApi };
