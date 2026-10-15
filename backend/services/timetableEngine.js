'use strict';

/**
 * Core Calculation Engine cho Hệ thống Thống kê Giờ dạy Giáo viên
 * Tuân thủ 100% các tiêu chí SRS (TC-01 đến TC-12)
 */

function buildTeacherLookup(teachers) {
  const byCode = new Map();
  const byName = new Map();
  const byAlias = new Map();

  for (const t of teachers) {
    if (t.code) byCode.set(String(t.code).toUpperCase(), t.code);
    if (t.fullName) byName.set(String(t.fullName).trim().toLowerCase(), t.code);
    if (Array.isArray(t.aliases)) {
      for (const a of t.aliases) {
        if (a) byAlias.set(String(a).trim().toLowerCase(), t.code);
      }
    }
  }

  return { byCode, byName, byAlias };
}

function matchTeacher(identifier, lookup) {
  if (!identifier) return null;
  const clean = String(identifier).trim();
  const upper = clean.toUpperCase();
  const lower = clean.toLowerCase();

  if (lookup.byCode.has(upper)) return lookup.byCode.get(upper);
  if (lookup.byAlias.has(lower)) return lookup.byAlias.get(lower);
  if (lookup.byName.has(lower)) return lookup.byName.get(lower);
  return null;
}

function parseTeachersData(rows) {
  const validTeachers = [];
  const duplicates = [];
  const errors = [];
  const seenCodes = new Set();

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const code = row.code ? String(row.code).trim().toUpperCase() : '';
    const fullName = row.fullName ? String(row.fullName).trim() : '';

    if (!code || !fullName) {
      errors.push({ row: rowNum, error: 'Thiếu mã giáo viên hoặc họ tên' });
      return;
    }

    if (seenCodes.has(code)) {
      duplicates.push(code);
      errors.push({ row: rowNum, error: `Trùng lặp mã giáo viên: ${code}` });
      return;
    }

    seenCodes.add(code);

    const aliasList = [];
    if (row.aliases) {
      if (Array.isArray(row.aliases)) {
        aliasList.push(...row.aliases.map(s => String(s).trim()).filter(Boolean));
      } else {
        const parts = String(row.aliases).split(/[,;|]/).map(s => s.trim()).filter(Boolean);
        aliasList.push(...parts);
      }
    }

    validTeachers.push({
      id: row.id || `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      fullName,
      aliases: aliasList,
      department: row.department ? String(row.department).trim() : null,
      subject: row.subject ? String(row.subject).trim() : null,
      homeroomClass: row.homeroomClass ? String(row.homeroomClass).trim() : null,
      isActive: row.isActive !== false
    });
  });

  return { validTeachers, duplicates, errors };
}

function validateAndMapTimetableEntries(rawEntries, lookup) {
  const entries = [];
  const uniqueSlotKeys = new Set();
  let totalValid = 0;
  let totalWarnings = 0;

  for (const raw of rawEntries) {
    const slotKey = `${raw.classCode}_T${raw.dayOfWeek}_${raw.sessionOfDay}_P${raw.period}`;
    const matchedTeacherCode = matchTeacher(raw.teacherIdentifier, lookup);

    let isValid = true;
    let warning = null;

    if (!matchedTeacherCode) {
      isValid = false;
      warning = `Không tìm thấy giáo viên tương ứng với mã/tên "${raw.teacherIdentifier}"`;
    } else if (uniqueSlotKeys.has(slotKey)) {
      isValid = false;
      warning = `Trùng lịch học của lớp ${raw.classCode} vào Thứ ${raw.dayOfWeek}, Tiết ${raw.period} (${raw.sessionOfDay})`;
    }

    const isHomeroom =
      raw.sessionType === 'HOMEROOM' ||
      String(raw.subjectCode || '').toUpperCase() === 'SHL' ||
      String(raw.subjectCode || '').toUpperCase() === 'SINH HOẠT';

    if (isValid) {
      uniqueSlotKeys.add(slotKey);
      totalValid++;
    } else {
      totalWarnings++;
    }

    entries.push({
      dayOfWeek: Number(raw.dayOfWeek),
      sessionOfDay: raw.sessionOfDay,
      period: Number(raw.period),
      classCode: String(raw.classCode).trim(),
      subjectCode: String(raw.subjectCode).trim(),
      teacherIdentifier: String(raw.teacherIdentifier).trim(),
      matchedTeacherCode: matchedTeacherCode || null,
      isHomeroom,
      isValid,
      warning
    });
  }

  return { entries, totalValid, totalWarnings, uniqueSlotKeys };
}

/**
 * Lịch nghỉ của nhà trường (nghỉ toàn trường / theo khối / theo lớp).
 * closure = { date, sessionOfDay: 'MORNING'|'AFTERNOON'|'ALL_DAY', scope: 'SCHOOL'|'GRADE'|'CLASS', grades: [], classCodes: [] }
 */
function getClassGrade(classCode) {
  const m = String(classCode || '').trim().match(/^(\d{1,2})/);
  return m ? m[1] : null;
}

function closureMatchesSession(closure, session) {
  if (!closure || !session) return false;
  if (closure.date !== session.date) return false;
  if (closure.sessionOfDay && closure.sessionOfDay !== 'ALL_DAY' && closure.sessionOfDay !== session.sessionOfDay) return false;
  const scope = closure.scope || 'SCHOOL';
  if (scope === 'GRADE') {
    return (closure.grades || []).map(String).includes(getClassGrade(session.classCode));
  }
  if (scope === 'CLASS') {
    const code = String(session.classCode || '').trim().toUpperCase();
    return (closure.classCodes || []).some(c => String(c).trim().toUpperCase() === code);
  }
  return true;
}

function findClosureForSession(session, closures) {
  // Tiết đã được chuyển sang ngày khác để dạy bù thì vẫn tính như dạy bù bình thường
  if (session.status === 'MAKEUP' && session.actualDate && session.actualDate !== session.date) return null;
  return (closures || []).find(c => closureMatchesSession(c, session)) || null;
}

function calculateWorkload(teachers, sessions, duties, filters = {}, closures = []) {
  const { startDate = '1970-01-01', endDate = '2099-12-31', teacherCode, department } = filters;

  const result = {
    summary: [],
    drilldown: {}
  };

  const filteredTeachers = (teachers || []).filter(t => {
    if (teacherCode && t.code !== teacherCode) return false;
    if (department && t.department !== department) return false;
    return true;
  });

  for (const teacher of filteredTeachers) {
    const code = teacher.code;

    const drill = {
      assignedSessions: [],
      actualTaughtSessions: [],
      absenceSessions: [],
      substituteGivenSessions: [],
      makeupSessions: [],
      homeroomSessions: [],
      pendingSessions: [],
      closedSessions: [],
      duties: []
    };

    // 1. Phân công theo TKB: Ngày phân công trong [startDate, endDate]
    for (const s of (sessions || [])) {
      // 0. Tiết rơi vào lịch nghỉ của trường: không tính phân công, vắng, dự kiến hay thực dạy
      const closure = findClosureForSession(s, closures);
      if (closure) {
        if (s.date >= startDate && s.date <= endDate && s.assignedTeacherCode === code) {
          drill.closedSessions.push({ ...s, closureId: closure.id, closureReason: closure.reason || null });
        }
        continue;
      }

      if (s.date >= startDate && s.date <= endDate) {
        if (s.assignedTeacherCode === code) {
          drill.assignedSessions.push(s);

          if (s.status === 'CANCELLED' || (s.status === 'SUBSTITUTE' && s.actualTeacherCode !== code)) {
            drill.absenceSessions.push(s);
          }

          if (s.status === 'PENDING') {
            drill.pendingSessions.push(s);
          }
        }
      }

      // 2. Thực dạy thực tế: Theo ngày diễn ra (actualDate || s.date)
      const effectiveDate = s.actualDate || s.date;
      if (effectiveDate >= startDate && effectiveDate <= endDate) {
        const isHomeroom = s.sessionType === 'HOMEROOM';
        const isTeacherActual = s.actualTeacherCode === code;

        if (isTeacherActual) {
          if (isHomeroom) {
            // Tiết sinh hoạt lớp tính riêng
            if (s.status === 'CONFIRMED' || s.status === 'SUBSTITUTE') {
              drill.homeroomSessions.push(s);
            }
          } else {
            // Tiết môn học
            if (s.status === 'CONFIRMED' || s.status === 'SUBSTITUTE' || s.status === 'MAKEUP') {
              drill.actualTaughtSessions.push(s);

              if (s.assignedTeacherCode !== code && s.status === 'SUBSTITUTE') {
                drill.substituteGivenSessions.push(s);
              }

              if (s.adjustmentType === 'MAKEUP' || s.status === 'MAKEUP') {
                drill.makeupSessions.push(s);
              }
            }
          }
        }
      }
    }

    // 3. Trực trường: Lọc ngày trực trong khoảng
    for (const d of (duties || [])) {
      if (d.date >= startDate && d.date <= endDate) {
        if (d.actualTeacherCode === code && d.status === 'COMPLETED') {
          drill.duties.push(d);
        }
      }
    }

    const dutyTotal = drill.duties.reduce((sum, d) => sum + (Number(d.value) || 1), 0);

    const summaryItem = {
      teacherCode: code,
      teacherName: teacher.fullName,
      department: teacher.department || 'Chưa phân tổ',
      assignedPeriods: drill.assignedSessions.filter(s => s.sessionType === 'REGULAR').length,
      actualTaughtPeriods: drill.actualTaughtSessions.length,
      absencePeriods: drill.absenceSessions.length,
      substituteGivenPeriods: drill.substituteGivenSessions.length,
      makeupPeriods: drill.makeupSessions.length,
      homeroomPeriods: drill.homeroomSessions.length,
      dutyCount: dutyTotal,
      pendingPeriods: drill.pendingSessions.length,
      closedPeriods: drill.closedSessions.length
    };

    result.summary.push(summaryItem);
    result.drilldown[code] = drill;
  }

  return result;
}

module.exports = {
  buildTeacherLookup,
  matchTeacher,
  parseTeachersData,
  validateAndMapTimetableEntries,
  calculateWorkload,
  closureMatchesSession,
  findClosureForSession
};
