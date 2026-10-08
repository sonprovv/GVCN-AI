'use strict';
const { readJson } = require('../storage');

const STATUSES = ['present', 'late', 'absent'];
const VALID_STUDENT_STATUSES = ['Ổn định', 'Theo dõi', 'Cần hỗ trợ'];
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const round1 = n => Math.round(n * 10) / 10;

async function studentsFor(classId) {
  const students = await readJson('students');
  return students.filter(s => s.classId === classId);
}
async function attendanceFor(classId, date = today()) {
  const [students, attendance] = await Promise.all([studentsFor(classId), readJson('attendance')]);
  const session = attendance.sessions.find(s => s.classId === classId && s.date === date);
  const map = new Map((session?.records || []).map(r => [r.studentId, r.status]));
  const records = students.map(s => ({ studentId: s.id, name: s.name, state: map.get(s.id) || 'present' }));
  const present = records.filter(r => r.state === 'present').length;
  const late = records.filter(r => r.state === 'late').length;
  const absent = records.filter(r => r.state === 'absent').length;
  return { date, classId, saved: !!session, records, stats: { present, late, absent, rate: records.length ? round1((present + late) / records.length * 100) : 0 } };
}
async function dashboardFor(classId, date = today()) {
  const [students, attendance, allTasks] = await Promise.all([studentsFor(classId), attendanceFor(classId, date), readJson('tasks')]);
  const male = students.filter(s => s.gender === 'Nam').length;
  const female = students.filter(s => s.gender === 'Nữ').length;
  const avg = students.length ? round1(students.reduce((sum, s) => sum + s.averageScore, 0) / students.length) : 0;
  const groups = {
    good: students.filter(s => s.averageScore >= 8.5).length,
    fair: students.filter(s => s.averageScore >= 7 && s.averageScore < 8.5).length,
    pass: students.filter(s => s.averageScore >= 5 && s.averageScore < 7).length,
    support: students.filter(s => s.averageScore < 5).length
  };
  return { classId, date, students: { total: students.length, male, female, averageScore: avg, attentionCount: students.filter(s => s.status !== 'Ổn định').length, attention: students.filter(s => s.status !== 'Ổn định').slice(0, 6), groups }, attendance: { ...attendance.stats, saved: attendance.saved }, tasks: allTasks.filter(t => t.classId === classId) };
}
module.exports = { STATUSES, VALID_STUDENT_STATUSES, today, validDate, studentsFor, attendanceFor, dashboardFor };
