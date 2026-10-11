'use strict';

const { readJson, updateJson } = require('../storage');
const {
  calculateWorkload,
  buildTeacherLookup,
  matchTeacher,
  parseTeachersData,
  validateAndMapTimetableEntries
} = require('../services/timetableEngine');

function respond(res, status, body, extraHeaders = {}) {
  const origin = res.req?.headers?.origin || '*';
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Credentials': 'true',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

async function bodyJson(req) {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { throw new Error('JSON không hợp lệ'); }
    }
  }
  let size = 0, raw = '';
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error('Dữ liệu tải lên quá lớn');
    raw += chunk;
  }
  try { return JSON.parse(raw); } catch (e) { throw new Error('JSON không hợp lệ'); }
}

async function appendAuditLog(action, entity, details, performedBy = 'Admin') {
  try {
    await updateJson('teacher_audit_logs', (logs = []) => {
      const list = Array.isArray(logs) ? logs : [];
      list.unshift({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action,
        entity,
        details: typeof details === 'object' ? JSON.stringify(details) : String(details),
        performedBy,
        createdAt: new Date().toISOString()
      });
      return { data: list.slice(0, 300), result: true };
    });
  } catch (e) {
    console.error('[audit_log] Lỗi ghi log:', e.message);
  }
}

/**
 * Điều hướng API Thời khóa biểu & Giáo viên
 * Tự động hỗ trợ cả 2 định dạng:
 * 1. Có prefix: /api/timetable/teachers, /api/timetable/timetables, /api/timetable/sessions...
 * 2. Gọi trực tiếp: /api/teachers, /api/timetables, /api/sessions...
 */
async function handleTimetableApi(req, res, url, parts, method) {
  res.req = req;

  let routeParts = parts.slice(1); // bỏ 'api'
  if (routeParts[0] === 'timetable') {
    routeParts = routeParts.slice(1); // bỏ prefix 'timetable' nếu có
  }

  const resource = routeParts[0]; // 'teachers', 'timetables', 'sessions', 'duties', 'reports', 'audit-logs', 'health'
  const sub = routeParts[1];

  const TIMETABLE_RESOURCES = ['teachers', 'timetables', 'sessions', 'duties', 'reports', 'audit-logs', 'health'];
  const isTimetableRoute = parts[1] === 'timetable' || TIMETABLE_RESOURCES.includes(resource);

  if (!isTimetableRoute) {
    return false; // Không thuộc module thời khóa biểu, để route tiếp theo xử lý
  }

  // Xử lý CORS preflight
  if (method === 'OPTIONS') {
    const origin = req.headers.origin || '*';
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }

  // Health check
  if (resource === 'health') {
    respond(res, 200, { success: true, message: 'Timetable module is active' });
    return true;
  }

  // ==========================================
  // 1. MODULE GIÁO VIÊN (/api/teachers hoặc /api/timetable/teachers)
  // ==========================================
  if (resource === 'teachers') {
    // GET /api/teachers
    if (routeParts.length === 1 && method === 'GET') {
      const teachers = await readJson('teachers');
      const dept = url.searchParams.get('department');
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();

      let list = Array.isArray(teachers) ? teachers : [];
      if (dept) list = list.filter(t => t.department === dept);
      if (search) {
        list = list.filter(t =>
          (t.code && t.code.toLowerCase().includes(search)) ||
          (t.fullName && t.fullName.toLowerCase().includes(search)) ||
          (t.department && t.department.toLowerCase().includes(search)) ||
          (t.homeroomClass && t.homeroomClass.toLowerCase().includes(search)) ||
          (Array.isArray(t.aliases) && t.aliases.some(a => a.toLowerCase().includes(search)))
        );
      }
      respond(res, 200, { success: true, data: list });
      return true;
    }

    // POST /api/teachers
    if (routeParts.length === 1 && method === 'POST') {
      const body = await bodyJson(req);
      const code = String(body.code || '').trim().toUpperCase();
      const fullName = String(body.fullName || '').trim();

      if (!code || !fullName) {
        respond(res, 400, { success: false, error: 'Mã giáo viên và họ tên là bắt buộc' });
        return true;
      }

      const teachers = await readJson('teachers');
      const existing = (teachers || []).find(t => t.code === code);
      if (existing) {
        respond(res, 400, { success: false, error: `Mã giáo viên "${code}" đã tồn tại` });
        return true;
      }

      const newTeacher = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        code,
        fullName,
        department: body.department ? String(body.department).trim() : null,
        subject: body.subject ? String(body.subject).trim() : null,
        homeroomClass: body.homeroomClass ? String(body.homeroomClass).trim() : null,
        isActive: body.isActive !== false,
        aliases: Array.isArray(body.aliases) ? body.aliases.map(a => String(a).trim()).filter(Boolean) : []
      };

      await updateJson('teachers', (list = []) => {
        const arr = Array.isArray(list) ? list : [];
        arr.push(newTeacher);
        return { data: arr, result: newTeacher };
      });

      await appendAuditLog('CREATE', 'TEACHER', { code: newTeacher.code, fullName: newTeacher.fullName });
      respond(res, 201, { success: true, data: newTeacher });
      return true;
    }

    // POST /api/teachers/import (TC-01)
    if (sub === 'import' && method === 'POST') {
      const body = await bodyJson(req);
      const rows = body.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        respond(res, 400, { success: false, error: 'Dữ liệu danh sách giáo viên không hợp lệ' });
        return true;
      }

      const { validTeachers, duplicates, errors } = parseTeachersData(rows);
      if (errors.length > 0) {
        respond(res, 400, { success: false, error: 'Dữ liệu có lỗi hoặc trùng lặp', duplicates, errors });
        return true;
      }

      const currentTeachers = await readJson('teachers');
      const existingSet = new Set((currentTeachers || []).map(t => String(t.code).toUpperCase()));
      const conflicts = validTeachers.filter(t => existingSet.has(t.code)).map(t => t.code);

      if (conflicts.length > 0) {
        respond(res, 400, {
          success: false,
          error: `Mã giáo viên đã tồn tại trong hệ thống: ${conflicts.join(', ')}`,
          conflicts
        });
        return true;
      }

      await updateJson('teachers', (list = []) => {
        const arr = Array.isArray(list) ? list : [];
        arr.push(...validTeachers);
        return { data: arr, result: validTeachers.length };
      });

      await appendAuditLog('IMPORT', 'TEACHER', `Import thành công ${validTeachers.length} giáo viên`);
      respond(res, 200, {
        success: true,
        message: `Đã import thành công ${validTeachers.length} giáo viên`,
        importedCount: validTeachers.length
      });
      return true;
    }
  }

  // ==========================================
  // 2. MODULE THỜI KHÓA BIỂU (/api/timetables hoặc /api/timetable/timetables)
  // ==========================================
  if (resource === 'timetables') {
    // GET /api/timetables
    if (routeParts.length === 1 && method === 'GET') {
      const list = await readJson('timetables');
      respond(res, 200, { success: true, data: Array.isArray(list) ? list : [] });
      return true;
    }

    // POST /api/timetables (TC-02, TC-09)
    if (routeParts.length === 1 && method === 'POST') {
      const body = await bodyJson(req);
      const code = String(body.code || '').trim();
      const name = String(body.name || '').trim();
      const validFrom = String(body.validFrom || '').trim();

      if (!code || !name || !validFrom) {
        respond(res, 400, { success: false, error: 'Thiếu thông tin bắt buộc của phiên bản TKB' });
        return true;
      }

      const current = await readJson('timetables');
      if ((current || []).some(v => v.code === code)) {
        respond(res, 400, { success: false, error: `Mã phiên bản TKB "${code}" đã tồn tại` });
        return true;
      }

      const newVersion = {
        id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        code,
        name,
        validFrom,
        validTo: body.validTo ? String(body.validTo).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        isActive: true,
        entries: Array.isArray(body.entries) ? body.entries : []
      };

      await updateJson('timetables', (list = []) => {
        const arr = Array.isArray(list) ? list : [];
        arr.unshift(newVersion);
        return { data: arr, result: newVersion };
      });

      if (newVersion.entries.length > 0) {
        await updateJson('teaching_sessions', (sessions = []) => {
          const sArr = Array.isArray(sessions) ? sessions : [];
          return { data: sArr, result: true };
        });
      }

      await appendAuditLog('CREATE', 'TIMETABLE', `Tạo phiên bản TKB ${newVersion.code}`);
      respond(res, 201, { success: true, data: newVersion });
      return true;
    }
  }

  // ==========================================
  // 3. MODULE TIẾT DẠY THỰC TẾ (/api/sessions hoặc /api/timetable/sessions)
  // ==========================================
  if (resource === 'sessions') {
    // GET /api/sessions
    if (routeParts.length === 1 && method === 'GET') {
      const sessions = await readJson('teaching_sessions');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const teacherCode = url.searchParams.get('teacherCode');
      const classCode = url.searchParams.get('classCode');

      let list = Array.isArray(sessions) ? sessions : [];
      if (startDate && endDate) {
        list = list.filter(s => {
          const d = s.actualDate || s.date;
          return d >= startDate && d <= endDate;
        });
      }
      if (classCode) list = list.filter(s => s.classCode === classCode);
      if (teacherCode) {
        list = list.filter(s => s.assignedTeacherCode === teacherCode || s.actualTeacherCode === teacherCode);
      }

      respond(res, 200, { success: true, data: list });
      return true;
    }

    // POST /api/sessions/adjust (TC-04, TC-05, TC-06)
    if (sub === 'adjust' && method === 'POST') {
      const body = await bodyJson(req);
      const { sessionId, adjustmentType, replacementTeacherCode, newDate, reason, performedBy = 'Admin' } = body;

      if (!sessionId || !adjustmentType) {
        respond(res, 400, { success: false, error: 'Thiếu thông tin điều chỉnh tiết học' });
        return true;
      }

      let updated = null;
      await updateJson('teaching_sessions', (sessions = []) => {
        const arr = Array.isArray(sessions) ? sessions : [];
        const index = arr.findIndex(s => s.id === sessionId);
        if (index === -1) throw new Error('Không tìm thấy tiết học này');

        const s = { ...arr[index] };
        s.adjustmentType = adjustmentType;
        s.reason = reason || 'Điều chỉnh giờ dạy';

        if (adjustmentType === 'CANCEL') {
          s.status = 'CANCELLED';
        } else if (adjustmentType === 'SUBSTITUTE') {
          if (!replacementTeacherCode) throw new Error('Chưa chọn giáo viên dạy thay');
          s.status = 'SUBSTITUTE';
          s.actualTeacherCode = replacementTeacherCode;
        } else if (adjustmentType === 'MAKEUP') {
          if (!newDate) throw new Error('Chưa chọn ngày diễn ra dạy bù');
          s.status = 'MAKEUP';
          s.actualDate = newDate;
        } else if (adjustmentType === 'CONFIRM') {
          s.status = 'CONFIRMED';
          s.actualTeacherCode = s.assignedTeacherCode;
          s.actualDate = s.date;
        }

        arr[index] = s;
        updated = s;
        return { data: arr, result: s };
      });

      await appendAuditLog('ADJUST', 'SESSION', { sessionId, adjustmentType, reason, performedBy });
      respond(res, 200, { success: true, data: updated });
      return true;
    }

    // POST /api/sessions/bulk-confirm
    if (sub === 'bulk-confirm' && method === 'POST') {
      const body = await bodyJson(req);
      const { startDate, endDate, performedBy = 'Admin' } = body;

      if (!startDate || !endDate) {
        respond(res, 400, { success: false, error: 'Cần chọn khoảng ngày để xác nhận' });
        return true;
      }

      let count = 0;
      await updateJson('teaching_sessions', (sessions = []) => {
        const arr = Array.isArray(sessions) ? sessions : [];
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          if (s.date >= startDate && s.date <= endDate) {
            if (s.status === 'PENDING' || !s.status) {
              s.status = 'CONFIRMED';
              s.actualTeacherCode = s.assignedTeacherCode;
              s.actualDate = s.date;
              count++;
            }
          }
        }
        return { data: arr, result: count };
      });

      await appendAuditLog('CONFIRM', 'SESSION', `Xác nhận hàng loạt ${count} tiết từ ${startDate} đến ${endDate}`, performedBy);
      respond(res, 200, { success: true, message: `Đã xác nhận ${count} tiết học`, confirmedCount: count });
      return true;
    }
  }

  // ==========================================
  // 4. MODULE TRỰC TRƯỜNG (/api/duties hoặc /api/timetable/duties)
  // ==========================================
  if (resource === 'duties') {
    // GET /api/duties
    if (routeParts.length === 1 && method === 'GET') {
      const duties = await readJson('teacher_duties');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const teacherCode = url.searchParams.get('teacherCode');

      let list = Array.isArray(duties) ? duties : [];
      if (startDate && endDate) list = list.filter(d => d.date >= startDate && d.date <= endDate);
      if (teacherCode) list = list.filter(d => d.assignedTeacherCode === teacherCode || d.actualTeacherCode === teacherCode);

      respond(res, 200, { success: true, data: list });
      return true;
    }

    // POST /api/duties
    if (routeParts.length === 1 && method === 'POST') {
      const body = await bodyJson(req);
      const { date, sessionOfDay, timeRange, teacherCode, dutyType = 'TRUC_TRUONG', unit = 'LUOT', value = 1, notes } = body;

      if (!date || !teacherCode) {
        respond(res, 400, { success: false, error: 'Thiếu ngày hoặc giáo viên trực' });
        return true;
      }

      const newDuty = {
        id: `duty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date,
        sessionOfDay: sessionOfDay || 'MORNING',
        timeRange: timeRange || '06:45 - 11:30',
        assignedTeacherCode: teacherCode,
        actualTeacherCode: teacherCode,
        dutyType,
        unit,
        value: Number(value) || 1,
        status: 'COMPLETED',
        notes: notes || null
      };

      await updateJson('teacher_duties', (duties = []) => {
        const arr = Array.isArray(duties) ? duties : [];
        arr.push(newDuty);
        return { data: arr, result: newDuty };
      });

      await appendAuditLog('CREATE', 'DUTY', `Phân công trực ngày ${date} cho ${teacherCode}`);
      respond(res, 201, { success: true, data: newDuty });
      return true;
    }
  }

  // ==========================================
  // 5. MODULE BÁO CÁO THỐNG KÊ (/api/reports hoặc /api/timetable/reports)
  // ==========================================
  if (resource === 'reports') {
    // GET /api/reports/summary (TC-04, TC-05, TC-06, TC-08, TC-12)
    if (sub === 'summary' && method === 'GET') {
      const startDate = url.searchParams.get('startDate') || '2026-10-05';
      const endDate = url.searchParams.get('endDate') || '2026-10-11';
      const teacherCode = url.searchParams.get('teacherCode') || undefined;
      const department = url.searchParams.get('department') || undefined;

      const [teachers, sessions, duties] = await Promise.all([
        readJson('teachers'),
        readJson('teaching_sessions'),
        readJson('teacher_duties')
      ]);

      const result = calculateWorkload(
        Array.isArray(teachers) ? teachers : [],
        Array.isArray(sessions) ? sessions : [],
        Array.isArray(duties) ? duties : [],
        { startDate, endDate, teacherCode, department }
      );

      respond(res, 200, {
        success: true,
        data: result,
        meta: { startDate, endDate, totalTeachers: (teachers || []).length }
      });
      return true;
    }

    // GET /api/reports/export (Xuất file CSV/Excel UTF-8 có BOM)
    if (sub === 'export' && method === 'GET') {
      const startDate = url.searchParams.get('startDate') || '2026-10-05';
      const endDate = url.searchParams.get('endDate') || '2026-10-11';
      const teacherCode = url.searchParams.get('teacherCode') || undefined;
      const department = url.searchParams.get('department') || undefined;

      const [teachers, sessions, duties] = await Promise.all([
        readJson('teachers'),
        readJson('teaching_sessions'),
        readJson('teacher_duties')
      ]);

      const result = calculateWorkload(
        Array.isArray(teachers) ? teachers : [],
        Array.isArray(sessions) ? sessions : [],
        Array.isArray(duties) ? duties : [],
        { startDate, endDate, teacherCode, department }
      );

      const headers = [
        'Mã GV',
        'Họ và tên',
        'Tổ bộ môn',
        'Phân công (TKB)',
        'Thực dạy',
        'Nghỉ (Chưa dạy)',
        'Được dạy thay',
        'Dạy thay người khác',
        'Dạy bù',
        'Sinh hoạt lớp (SHL)',
        'Trực trường (lượt)',
        'Chênh lệch (+/-)'
      ];

      const rows = (result.summary || []).map(r => [
        `"${r.teacherCode}"`,
        `"${r.fullName}"`,
        `"${r.department || ''}"`,
        r.assignedPeriods,
        r.actualTaughtPeriods,
        r.absencePeriods,
        r.substituteTakenPeriods,
        r.substituteGivenPeriods,
        r.makeupPeriods,
        r.homeroomPeriods,
        r.dutyCount,
        r.difference
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
      const origin = req.headers.origin || '*';
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bao-cao-gio-day-${startDate}-${endDate}.csv"`,
        'Access-Control-Allow-Origin': origin,
        'Cache-Control': 'no-store'
      });
      res.end(csvContent);
      return true;
    }
  }

  // ==========================================
  // 6. MODULE NHẬT KÝ THAO TÁC (/api/audit-logs hoặc /api/timetable/audit-logs)
  // ==========================================
  if (resource === 'audit-logs') {
    if (routeParts.length === 1 && method === 'GET') {
      const logs = await readJson('teacher_audit_logs');
      respond(res, 200, { success: true, data: Array.isArray(logs) ? logs : [] });
      return true;
    }
  }

  // Nếu request có prefix /api/timetable/... hoặc resource thuộc danh sách timetable nhưng không đúng method
  respond(res, 404, { success: false, error: 'Endpoint thời khóa biểu không tồn tại' });
  return true;
}

module.exports = { handleTimetableApi };
