'use strict';
const ALLOWED = new Set([
  'classes', 'students', 'attendance', 'subjects', 'tasks', 'templates', 'reports', 'messages', 'cloud_rooms', 'duty', 'classTables',
  'teachers', 'timetables', 'teaching_sessions', 'teacher_duties', 'teacher_audit_logs'
]);
module.exports = { ALLOWED };
