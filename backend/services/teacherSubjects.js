'use strict';

/**
 * Suy ra môn dạy & tổ chuyên môn của giáo viên từ chính Thời khóa biểu.
 * Mỗi ô TKB dạng "10A1 - Toán" cho biết giáo viên dạy môn gì, nên đây là nguồn đáng tin hơn
 * việc đoán từ tên viết tắt.
 */

const { buildTeacherLookup, matchTeacher } = require('./timetableEngine');
const { buildClassTimeline, getEffectiveRange, todayInVietnam } = require('./timetableVersions');

// Mã môn trên TKB -> tên môn đầy đủ và tổ chuyên môn (khớp danh sách tổ trên giao diện)
const SUBJECTS = {
  'TOÁN': { subject: 'Toán', department: 'Toán - Tin' },
  'TIN': { subject: 'Tin học', department: 'Toán - Tin' },
  'VĂN': { subject: 'Ngữ văn', department: 'Ngữ văn' },
  'NNGỮ': { subject: 'Ngoại ngữ', department: 'Ngoại ngữ' },
  'ANH': { subject: 'Tiếng Anh', department: 'Ngoại ngữ' },
  'LÝ': { subject: 'Vật lý', department: 'KHTN' },
  'HOÁ': { subject: 'Hóa học', department: 'KHTN' },
  'HÓA': { subject: 'Hóa học', department: 'KHTN' },
  'SINH': { subject: 'Sinh học', department: 'KHTN' },
  'CNCN': { subject: 'Công nghệ (Công nghiệp)', department: 'KHTN' },
  'CNNN': { subject: 'Công nghệ (Nông nghiệp)', department: 'KHTN' },
  'SỬ': { subject: 'Lịch sử', department: 'KHXH' },
  'ĐỊA': { subject: 'Địa lí', department: 'KHXH' },
  'GDKTPL': { subject: 'GDKT&PL', department: 'KHXH' },
  'GDDP': { subject: 'GD địa phương', department: 'KHXH' },
  'GDTC': { subject: 'GDTC', department: 'Thể dục - GDQP' },
  'QPAN': { subject: 'GDQP-AN', department: 'Thể dục - GDQP' }
};

// Không phải môn chuyên môn: sinh hoạt lớp, hoạt động trải nghiệm, chào cờ
const NON_SUBJECT_RE = /^(SHL|SINH HOẠT( LỚP)?|HĐTN|HĐTNHN|CC|CHÀO CỜ)$/i;

function normalizeSubjectCode(raw) {
  return String(raw || '').normalize('NFC').trim().toUpperCase();
}

/**
 * Lấy các tiết TKB đang áp dụng: với mỗi lớp, phiên bản hiệu lực hôm nay
 * (hoặc phiên bản mới nhất nếu hôm nay chưa/không có).
 */
function currentEntries(versions, today) {
  const timeline = buildClassTimeline(versions);
  const entries = [];
  for (const [cls, ranges] of timeline) {
    const range = getEffectiveRange(timeline, cls, today) || ranges[ranges.length - 1];
    if (!range) continue;
    for (const e of range.version.entries || []) {
      if (String(e.classCode || '').trim().toUpperCase() === cls) entries.push(e);
    }
  }
  return entries;
}

function suggestTeacherSubjects(teachers, versions, today = todayInVietnam()) {
  const lookup = buildTeacherLookup(teachers || []);
  const counts = new Map(); // teacherCode -> Map(subjectCode -> count)

  for (const e of currentEntries(versions || [], today)) {
    const code = matchTeacher(e.teacherCode || e.teacherName, lookup) || matchTeacher(e.teacherName, lookup);
    if (!code) continue;
    const subjectCode = normalizeSubjectCode(e.subjectCode || e.subject);
    if (!subjectCode || NON_SUBJECT_RE.test(subjectCode)) continue;
    if (!counts.has(code)) counts.set(code, new Map());
    const m = counts.get(code);
    m.set(subjectCode, (m.get(subjectCode) || 0) + 1);
  }

  return (teachers || []).map(t => {
    const m = counts.get(t.code);
    const subjects = m
      ? [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([subjectCode, count]) => ({ subjectCode, name: (SUBJECTS[subjectCode] || {}).subject || subjectCode, count }))
      : [];
    const main = subjects[0];
    const known = main ? SUBJECTS[main.subjectCode] : null;
    const suggested = main
      ? { subject: main.name, department: known ? known.department : null }
      : null;
    const total = subjects.reduce((s, x) => s + x.count, 0);

    return {
      code: t.code,
      fullName: t.fullName,
      current: { subject: t.subject || null, department: t.department || null },
      suggested,
      subjects,
      // Dạy từ 2 môn trở lên với môn phụ chiếm >= 25% số tiết -> nên kiểm tra tay
      mixed: subjects.length > 1 && subjects[1].count / total >= 0.25,
      unknownSubject: Boolean(main && !known),
      changed: Boolean(suggested) &&
        (suggested.subject !== (t.subject || null) || (suggested.department && suggested.department !== (t.department || null)))
    };
  });
}

module.exports = { SUBJECTS, suggestTeacherSubjects };
