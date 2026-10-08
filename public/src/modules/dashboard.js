import { api, withClass } from '../api/client.js';
import { escapeHtml, initials, statusClass, toast } from '../utils.js';

let classIdRef;
export function initDashboard(getClassId) {
  classIdRef = getClassId;
  document.getElementById('taskList').addEventListener('change', async event => {
    if (!event.target.matches('input[data-task-id]')) return;
    const input = event.target;
    input.disabled = true;
    try {
      await api(`/api/tasks/${encodeURIComponent(input.dataset.taskId)}`, { method: 'PATCH', body: { done: input.checked } });
      toast(input.checked ? 'Đã hoàn thành công việc' : 'Đã mở lại công việc');
    } catch (error) { input.checked = !input.checked; toast(error.message); }
    finally { input.disabled = false; }
  });
}
export async function loadDashboard() {
  const data = await api(withClass('/api/dashboard', classIdRef()));
  document.getElementById('dashboardTotal').textContent = data.students.total;
  document.getElementById('dashboardGender').textContent = `${data.students.female} nữ · ${data.students.male} nam`;
  document.getElementById('dashboardAttendance').textContent = data.attendance.saved ? data.attendance.rate.toFixed(1) + '%' : 'Chưa điểm danh';
  document.getElementById('dashboardAverage').textContent = data.students.averageScore.toFixed(1);
  document.getElementById('dashboardAttention').textContent = data.students.attentionCount;
  document.getElementById('dashboardClassTitle').textContent = `Tổng quan nhanh lớp ${data.classId} hôm nay.`;
  document.getElementById('dashboardAttendanceNote').textContent = data.attendance.saved ? `Có mặt ${data.attendance.present} · Muộn ${data.attendance.late} · Vắng ${data.attendance.absent}` : 'Chưa lưu dữ liệu hôm nay';

  document.getElementById('taskList').innerHTML = data.tasks.length ? data.tasks.map(t => `
    <label class="task">
      <input type="checkbox" data-task-id="${escapeHtml(t.id)}" ${t.done ? 'checked' : ''}>
      <span class="checkmark"></span>
      <div><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.note)}</small></div>
      <span class="tag ${['urgent','info','purple','neutral'].includes(t.tone) ? t.tone : 'neutral'}">${escapeHtml(t.tag)}</span>
    </label>`).join('') : '<p class="muted empty-state">Chưa có công việc</p>';

  document.getElementById('attentionTable').innerHTML = data.students.attention.length ? data.students.attention.map((s, i) => `
    <tr><td><div class="student-cell"><span class="student-avatar a${i % 3 + 1}">${escapeHtml(initials(s.name))}</span><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.id)}</small></div></div></td>
    <td><span class="status ${statusClass(s.status)}">${escapeHtml(s.status)}</span></td><td>${s.averageScore.toFixed(1)}</td><td>${s.attendanceRate}%</td>
    <td><button class="mini-action" data-page-link="students">Xem hồ sơ</button></td></tr>`).join('') : '<tr><td colspan="5">Không có học sinh cần lưu ý</td></tr>';
  renderLearningSummary(data.students.groups, data.students.total);
  return data;
}
function renderLearningSummary(groups, total) {
  document.getElementById('learningTotal').textContent = total;
  const list = [['good', 'Tốt', '#0f766e', 'l1'], ['fair','Khá','#4ebcae','l2'], ['pass','Đạt','#e7b25f','l3'], ['support','Cần hỗ trợ','#df6678','l4']];
  document.getElementById('learningLegend').innerHTML = list.map(([key, name,, colorClass]) => `<span><i class="${colorClass}"></i>${name} ${groups[key] || 0}</span>`).join('');
  let offset = 0;
  const stops = [];
  for (const [key,, color] of list) {
    const next = offset + (total ? groups[key] / total * 100 : 0);
    stops.push(`${color} ${offset}% ${next}%`);
    offset = next;
  }
  document.querySelector('.donut').style.background = total ? `conic-gradient(${stops.join(',')})` : '#e8eeed';
}
