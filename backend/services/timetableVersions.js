'use strict';

/**
 * Phiên bản Thời khóa biểu & sinh tiết học
 *
 * Quy tắc hiệu lực: với mỗi lớp, TKB áp dụng vào một ngày là phiên bản (đang bật) có
 * validFrom mới nhất <= ngày đó và có tiết của lớp này. Vì vậy không cần nhập ngày kết thúc:
 * TKB cũ của một lớp tự kết thúc vào ngày trước khi TKB mới của lớp đó bắt đầu.
 * Nếu phiên bản có nhập validTo thì vẫn tôn trọng (lấy ngày sớm hơn).
 *
 * Sinh tiết học: tiết đã xác nhận / đã điều chỉnh không bao giờ bị sửa; chỉ tiết chưa xác nhận
 * (PENDING) được tạo lại theo TKB đang hiệu lực.
 */

const { buildTeacherLookup, matchTeacher } = require('./timetableEngine');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GENERATE_DAYS = 62;

function isDateStr(value) {
  return DATE_RE.test(String(value || ''));
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function daysBetween(startDate, endDate) {
  const a = Date.parse(startDate + 'T00:00:00Z');
  const b = Date.parse(endDate + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

// Thứ theo cách gọi Việt Nam: 2 = Thứ Hai ... 7 = Thứ Bảy, 8 = Chủ nhật
function vnDayOfWeek(dateStr) {
  const jsDay = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return jsDay === 0 ? 8 : jsDay + 1;
}

function todayInVietnam() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function normalizeClass(classCode) {
  return String(classCode || '').trim().toUpperCase();
}

// Mã lớp hợp lệ dạng 10A1, 12A10... (bỏ qua các dòng đọc lỗi như "Khối")
function isValidClassCode(classCode) {
  return /^\d{1,2}[A-Z]/.test(normalizeClass(classCode));
}

function slotKey(date, classCode, sessionOfDay, period) {
  return `${date}|${normalizeClass(classCode)}|${sessionOfDay}|${Number(period)}`;
}

function usableVersions(versions) {
  return (versions || []).filter(v => v && v.isActive !== false && isDateStr(v.validFrom));
}

/**
 * Dòng thời gian TKB theo lớp: Map<classCode, [{ version, from, to }]> (to = null nghĩa là chưa kết thúc).
 * Hai phiên bản cùng validFrom cho cùng lớp: phiên bản tạo sau được dùng.
 */
function buildClassTimeline(versions) {
  const list = usableVersions(versions);
  // Mảng lưu phiên bản mới nhất ở đầu (unshift) -> index lớn hơn là tạo trước
  const order = new Map(list.map((v, i) => [v, v.createdAt ? Date.parse(v.createdAt) : -i]));

  const byClass = new Map();
  for (const v of list) {
    const classes = new Set((v.entries || []).map(e => normalizeClass(e.classCode)).filter(isValidClassCode));
    for (const c of classes) {
      if (!byClass.has(c)) byClass.set(c, []);
      byClass.get(c).push(v);
    }
  }

  const timeline = new Map();
  for (const [c, vs] of byClass) {
    vs.sort((a, b) => a.validFrom.localeCompare(b.validFrom) || order.get(a) - order.get(b));
    const ranges = [];
    vs.forEach((v, i) => {
      const next = vs[i + 1];
      let to = next ? addDays(next.validFrom, -1) : null;
      if (isDateStr(v.validTo) && (to === null || v.validTo < to)) to = v.validTo;
      if (to !== null && to < v.validFrom) return; // bị phiên bản cùng ngày bắt đầu thay thế hoàn toàn
      ranges.push({ version: v, from: v.validFrom, to });
    });
    timeline.set(c, ranges);
  }
  return timeline;
}

function getEffectiveRange(timeline, classCode, date) {
  const ranges = timeline.get(normalizeClass(classCode)) || [];
  return ranges.find(r => r.from <= date && (r.to === null || date <= r.to)) || null;
}

/**
 * Thông tin hiệu lực suy ra cho từng phiên bản (dùng để hiển thị).
 * status: UPCOMING | ACTIVE | PARTIAL (một số lớp đã có TKB mới) | REPLACED | EMPTY (không có lớp hợp lệ)
 */
function describeVersions(versions, today = todayInVietnam()) {
  const timeline = buildClassTimeline(versions);
  const info = new Map();

  for (const v of versions || []) {
    info.set(v, { classCount: 0, activeClassCount: 0, ends: [], open: false, replacedBy: new Set() });
  }
  for (const [, ranges] of timeline) {
    ranges.forEach((r, i) => {
      const item = info.get(r.version);
      item.classCount++;
      if (r.to === null) item.open = true;
      else item.ends.push(r.to);
      if (r.from <= today && (r.to === null || today <= r.to)) item.activeClassCount++;
      const next = ranges[i + 1];
      if (next) item.replacedBy.add(next.version.code);
    });
  }

  return (versions || []).map(v => {
    const item = info.get(v);
    const effectiveTo = item.open || item.ends.length === 0 ? (isDateStr(v.validTo) ? v.validTo : null) : item.ends.sort().pop();
    let status;
    if (v.isActive === false) status = 'INACTIVE';
    else if (item.classCount === 0) status = 'EMPTY';
    else if (v.validFrom > today) status = 'UPCOMING';
    else if (item.activeClassCount === 0) status = 'REPLACED';
    else if (item.activeClassCount < item.classCount) status = 'PARTIAL';
    else status = 'ACTIVE';

    const { entries, ...rest } = v;
    return {
      ...rest,
      entries,
      effectiveTo,
      status,
      classCount: item.classCount,
      activeClassCount: item.activeClassCount,
      replacedBy: [...item.replacedBy]
    };
  });
}

/**
 * Danh sách tiết học dự kiến (PENDING) trong [startDate, endDate] theo TKB đang hiệu lực của từng lớp.
 */
function buildExpectedSessions(versions, teachers, startDate, endDate) {
  const timeline = buildClassTimeline(versions);
  const lookup = buildTeacherLookup(teachers || []);

  // Gom tiết của mỗi phiên bản theo lớp + thứ
  const grouped = new Map();
  const stats = { invalidClassEntries: 0, duplicateSlots: 0, unmatchedTeachers: new Set() };
  for (const v of usableVersions(versions)) {
    const g = new Map();
    const seen = new Set();
    for (const e of v.entries || []) {
      const cls = normalizeClass(e.classCode);
      if (!isValidClassCode(cls)) {
        stats.invalidClassEntries++;
        continue;
      }
      const key = `${cls}|${Number(e.dayOfWeek)}|${e.sessionOfDay}|${Number(e.period)}`;
      if (seen.has(key)) {
        stats.duplicateSlots++;
        continue;
      }
      seen.add(key);
      const gk = `${cls}|${Number(e.dayOfWeek)}`;
      if (!g.has(gk)) g.set(gk, []);
      g.get(gk).push(e);
    }
    grouped.set(v, g);
  }

  const expected = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const dow = vnDayOfWeek(date);
    for (const cls of timeline.keys()) {
      const range = getEffectiveRange(timeline, cls, date);
      if (!range) continue;
      const v = range.version;
      for (const e of grouped.get(v).get(`${cls}|${dow}`) || []) {
        const rawTeacher = e.teacherCode || e.matchedTeacherCode || e.teacherIdentifier || e.teacherName || '';
        const teacherCode = matchTeacher(rawTeacher, lookup) || matchTeacher(e.teacherName, lookup);
        if (!teacherCode && rawTeacher) stats.unmatchedTeachers.add(String(rawTeacher));
        const subjectCode = String(e.subjectCode || e.subject || '').trim();
        const isHomeroom = e.isHomeroom === true || e.sessionType === 'HOMEROOM' || /^(SHL|SINH HOẠT)/i.test(subjectCode);

        expected.push({
          id: `sess-${date}-${cls}-${e.sessionOfDay === 'AFTERNOON' ? 'C' : 'S'}-${Number(e.period)}`,
          date,
          dayOfWeek: dow,
          sessionOfDay: e.sessionOfDay === 'AFTERNOON' ? 'AFTERNOON' : 'MORNING',
          period: Number(e.period),
          classCode: cls,
          subjectCode,
          subject: String(e.subject || subjectCode),
          assignedTeacherCode: teacherCode || String(rawTeacher),
          sessionType: isHomeroom ? 'HOMEROOM' : 'REGULAR',
          timetableId: v.id,
          timetableVersionCode: v.code,
          status: 'PENDING'
        });
      }
    }
  }

  return {
    expected,
    stats: {
      invalidClassEntries: stats.invalidClassEntries,
      duplicateSlots: stats.duplicateSlots,
      unmatchedTeachers: [...stats.unmatchedTeachers].slice(0, 50)
    }
  };
}

function isLocked(session) {
  return Boolean(session.status) && session.status !== 'PENDING';
}

function normalizeSubject(session) {
  return String(session.subjectCode || session.subject || '').normalize('NFC').trim().toUpperCase();
}

// Cùng giáo viên & môn: dùng để báo tiết đã chốt khác TKB
function sameTeaching(a, b) {
  return a.assignedTeacherCode === b.assignedTeacherCode && normalizeSubject(a) === normalizeSubject(b);
}

// Giống hệt (kể cả phiên bản TKB): dùng để quyết định có cần cập nhật tiết PENDING không
function sameContent(a, b) {
  return sameTeaching(a, b) && a.sessionType === b.sessionType && a.timetableId === b.timetableId;
}

/**
 * Kế hoạch đồng bộ tiết học trong [startDate, endDate] với danh sách dự kiến.
 * - Tiết đã xác nhận/điều chỉnh: giữ nguyên (nếu khác TKB mới thì báo vào conflicts).
 * - Tiết PENDING: cập nhật theo TKB mới, hoặc xóa nếu TKB mới không còn tiết đó.
 * - Ô chưa có tiết: thêm mới.
 */
function planSessionSync(existingSessions, expected, startDate, endDate) {
  const expectedBySlot = new Map(expected.map(s => [slotKey(s.date, s.classCode, s.sessionOfDay, s.period), s]));
  const coveredSlots = new Set();
  const toRemove = new Set();
  const toUpdate = new Map();
  const conflicts = [];
  let kept = 0;
  let unchanged = 0;

  for (const s of existingSessions || []) {
    if (!(s.date >= startDate && s.date <= endDate)) continue;
    const key = slotKey(s.date, s.classCode, s.sessionOfDay, s.period);
    const exp = expectedBySlot.get(key);

    if (isLocked(s)) {
      kept++;
      coveredSlots.add(key);
      // Tiết đã chốt nhưng khác TKB đang hiệu lực (hoặc TKB không còn tiết này): báo để người dùng tự kiểm tra
      if (!exp || !sameTeaching(s, exp)) {
        conflicts.push({
          sessionId: s.id,
          date: s.date,
          classCode: s.classCode,
          sessionOfDay: s.sessionOfDay,
          period: s.period,
          status: s.status,
          current: { teacher: s.assignedTeacherCode, subject: s.subjectCode || s.subject || null },
          timetable: exp
            ? { teacher: exp.assignedTeacherCode, subject: exp.subjectCode, version: exp.timetableVersionCode }
            : null
        });
      }
      continue;
    }

    if (!exp || coveredSlots.has(key)) {
      toRemove.add(s.id);
      continue;
    }
    coveredSlots.add(key);
    if (sameContent(s, exp)) {
      unchanged++;
    } else {
      // Giữ id cũ để nhật ký / tham chiếu không bị gãy
      toUpdate.set(s.id, { ...exp, id: s.id });
    }
  }

  const toAdd = expected.filter(s => !coveredSlots.has(slotKey(s.date, s.classCode, s.sessionOfDay, s.period)));

  return { toAdd, toUpdate, toRemove, conflicts, kept, unchanged };
}

function applySessionSync(sessions, plan) {
  const arr = (Array.isArray(sessions) ? sessions : [])
    .filter(s => !plan.toRemove.has(s.id))
    .map(s => plan.toUpdate.get(s.id) || s);
  const ids = new Set(arr.map(s => s.id));
  for (const s of plan.toAdd) {
    let id = s.id;
    for (let n = 2; ids.has(id); n++) id = `${s.id}-${n}`;
    ids.add(id);
    arr.push({ ...s, id });
  }
  return arr;
}

function summarizePlan(plan, stats) {
  return {
    created: plan.toAdd.length,
    updated: plan.toUpdate.size,
    removed: plan.toRemove.size,
    unchanged: plan.unchanged,
    keptConfirmed: plan.kept,
    conflictCount: plan.conflicts.length,
    conflicts: plan.conflicts.slice(0, 50),
    skipped: stats
  };
}

module.exports = {
  MAX_GENERATE_DAYS,
  isDateStr,
  addDays,
  daysBetween,
  vnDayOfWeek,
  todayInVietnam,
  buildClassTimeline,
  getEffectiveRange,
  describeVersions,
  buildExpectedSessions,
  planSessionSync,
  applySessionSync,
  summarizePlan
};
