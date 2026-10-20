'use strict';
// Dữ liệu "lớp học" (danh sách lớp, học sinh, điểm danh, công việc...) và dữ liệu
// "thời khóa biểu / GVCN" (giáo viên, TKB, tiết dạy, trực...) được lưu ở 2 bảng Postgres riêng.
const CLASS_TABLE = 'gvcn_class_documents';
const TIMETABLE_TABLE = 'gvcn_timetable_documents';

const CLASS_GROUP = new Set([
  'classes', 'students', 'attendance', 'subjects', 'tasks', 'templates', 'reports', 'messages', 'cloud_rooms', 'duty', 'classTables'
]);
const TIMETABLE_GROUP = new Set([
  'teachers', 'timetables', 'teaching_sessions', 'teacher_duties', 'teacher_audit_logs', 'school_closures'
]);

const ALLOWED = new Set([...CLASS_GROUP, ...TIMETABLE_GROUP]);

function tableFor(name) {
  if (CLASS_GROUP.has(name)) return CLASS_TABLE;
  if (TIMETABLE_GROUP.has(name)) return TIMETABLE_TABLE;
  throw new Error('Unknown JSON collection');
}

module.exports = { ALLOWED, CLASS_GROUP, TIMETABLE_GROUP, CLASS_TABLE, TIMETABLE_TABLE, tableFor };
