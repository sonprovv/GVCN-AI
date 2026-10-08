import { api, withClass } from '../api/client.js';
import { escapeHtml, initials, toast, todayLocal } from '../utils.js';

let classIdGetter, refreshDashboard, rows = [];
let requestToken = 0;
export function initAttendance(getClassId, onSaved) {
  classIdGetter = getClassId;
  refreshDashboard = onSaved;
  document.getElementById('attendanceDate').value = todayLocal();
  document.getElementById('attendanceDate').addEventListener('change', loadAttendance);
  document.getElementById('attendanceList').addEventListener('click', e => {
    const target = e.target.closest('button[data-student][data-state]');
    if (!target) return;
    const student = rows.find(r => r.studentId === target.dataset.student);
    if (!student) return;
    student.state = target.dataset.state;
    renderRows();
  });
  document.getElementById('saveAttendance').addEventListener('click', async () => {
    const btn = document.getElementById('saveAttendance');
    btn.disabled = true;
    try {
      const date = document.getElementById('attendanceDate').value;
      await api(`/api/attendance/${encodeURIComponent(date)}`, { method: 'PUT', body: {
        classId: classIdGetter(), records: rows.map(r => ({ studentId: r.studentId, status: r.state }))
      } });
      toast('Đã lưu điểm danh vào JSON');
      document.getElementById('attendanceSaveState').textContent = 'Đã lưu dữ liệu ngày này trên server';
      await refreshDashboard();
    } catch (error) { toast(error.message); }
    finally { btn.disabled = false; }
  });
}
export async function loadAttendance() {
  const token = ++requestToken;
  const date = document.getElementById('attendanceDate').value;
  const data = await api(`${withClass('/api/attendance', classIdGetter())}&date=${encodeURIComponent(date)}`);
  if (token !== requestToken) return;
  rows = data.records;
  document.getElementById('attendanceSaveState').textContent = data.saved ? 'Đã lưu dữ liệu ngày này trên server' : 'Chưa điểm danh ngày này · trạng thái đang hiển thị chỉ là bản nháp';
  renderRows();
}
function renderRows() {
  document.getElementById('attendanceList').innerHTML = rows.length ? rows.map((r, i) => `
    <div class="attendance-row"><span class="student-avatar a${i % 3 + 1}">${escapeHtml(initials(r.name))}</span>
    <div class="name"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.studentId)}</small></div>
    <div class="att-buttons">
      ${[['present','Có mặt'],['late','Muộn'],['absent','Vắng']].map(([state, label]) => `<button data-student="${escapeHtml(r.studentId)}" data-state="${state}" class="${r.state === state ? 'active' : ''}">${label}</button>`).join('')}
    </div></div>`).join('') : '<p class="muted">Chưa có học sinh trong lớp này</p>';
  const counts = {
    present: rows.filter(r => r.state === 'present').length,
    late: rows.filter(r => r.state === 'late').length,
    absent: rows.filter(r => r.state === 'absent').length
  };
  document.getElementById('presentCount').textContent = counts.present;
  document.getElementById('lateCount').textContent = counts.late;
  document.getElementById('absentCount').textContent = counts.absent;
  document.getElementById('rateCount').textContent = (rows.length ? ((counts.present + counts.late) / rows.length * 100) : 0).toFixed(1) + '%';
}
