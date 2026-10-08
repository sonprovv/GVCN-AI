import { api } from '../api/client.js';
import { escapeHtml, initials, statusClass, toast } from '../utils.js';

let getClassId, onChange, students = [], loadToken = 0;
const $ = id => document.getElementById(id);
const fields = [
  ['name','Họ tên','text'],['gender','Giới tính','select'],['averageScore','Điểm trung bình','number'],
  ['attendanceRate','Chuyên cần (%)','number'],['status','Trạng thái','select']
];
export function initStudents(classGetter, changed) {
  getClassId = classGetter;
  onChange = changed;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop" id="studentModal">
      <div class="modal" style="max-width:490px">
        <div class="modal-head"><h3 id="studentModalTitle">Thêm học sinh</h3><button class="icon-btn" type="button" id="studentModalClose">×</button></div>
        <form id="studentForm" class="student-form">
          <label>Họ và tên<input class="input" required name="name" maxlength="100"></label>
          <label>Giới tính<select class="input" name="gender"><option>Nam</option><option>Nữ</option><option>Khác</option></select></label>
          <label>Điểm trung bình<input class="input" type="number" name="averageScore" min="0" max="10" step="0.1" required></label>
          <label>Chuyên cần (%)<input class="input" type="number" name="attendanceRate" min="0" max="100" step="0.1" required></label>
          <label>Trạng thái<select class="input" name="status"><option>Ổn định</option><option>Theo dõi</option><option>Cần hỗ trợ</option></select></label>
          <div class="header-tools" style="justify-content:flex-end;margin-top:10px"><button type="button" class="secondary" id="studentCancel">Hủy</button><button class="primary" type="submit">Lưu học sinh</button></div>
        </form>
      </div>
    </div>`);
  $('addStudentBtn').addEventListener('click', () => openStudentForm());
  $('studentModalClose').addEventListener('click', closeStudentForm);
  $('studentCancel').addEventListener('click', closeStudentForm);
  $('studentModal').addEventListener('click', e => { if (e.target === $('studentModal')) closeStudentForm(); });
  $('studentForm').addEventListener('submit', submitStudent);
  $('studentSearch').addEventListener('input', loadStudents);
  $('studentStatusFilter').addEventListener('change', loadStudents);
  $('studentTable').addEventListener('click', async e => {
    const edit = e.target.closest('[data-edit-student]');
    const del = e.target.closest('[data-delete-student]');
    if (edit) return openStudentForm(students.find(s => s.id === edit.dataset.editStudent));
    if (del && confirm(`Xóa học sinh ${del.dataset.deleteStudent} khỏi dữ liệu demo?`)) {
      try {
        await api(`/api/students/${encodeURIComponent(del.dataset.deleteStudent)}`, { method: 'DELETE' });
        toast('Đã xóa học sinh');
        await onChange();
      } catch (error) { toast(error.message); }
    }
  });
}
export async function loadStudents() {
  const token = ++loadToken;
  const filter = new URLSearchParams({ classId: getClassId(), q: $('studentSearch').value.trim(), status: $('studentStatusFilter').value });
  const rows = await api(`/api/students?${filter}`);
  if (token !== loadToken) return;
  students = rows;
  $('studentTable').innerHTML = rows.length ? rows.map((s, i) => `
    <tr><td><div class="student-cell"><span class="student-avatar a${i % 3 + 1}">${escapeHtml(initials(s.name))}</span><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.id)}</small></div></div></td>
    <td>${escapeHtml(s.gender)}</td><td>${s.averageScore.toFixed(1)}</td><td>${s.attendanceRate}%</td>
    <td><span class="status ${statusClass(s.status)}">${escapeHtml(s.status)}</span></td>
    <td><div class="action-pair"><button class="mini-action" data-edit-student="${escapeHtml(s.id)}">Sửa</button><button class="mini-action danger" data-delete-student="${escapeHtml(s.id)}">Xóa</button></div></td></tr>`).join('') : '<tr><td colspan="6">Không có học sinh phù hợp</td></tr>';
}
let editingId = null;
function openStudentForm(student = null) {
  editingId = student?.id || null;
  $('studentForm').reset();
  $('studentModalTitle').textContent = student ? `Sửa thông tin: ${student.name}` : `Thêm học sinh vào ${getClassId()}`;
  if (student) {
    for (const [key] of fields) $('studentForm').elements.namedItem(key).value = student[key];
  } else {
    $('studentForm').elements.namedItem('averageScore').value = '8';
    $('studentForm').elements.namedItem('attendanceRate').value = '100';
  }
  $('studentModal').classList.add('show');
}
function closeStudentForm() { $('studentModal').classList.remove('show'); }
async function submitStudent(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = {
    name: form.elements.namedItem('name').value.trim(), gender: form.elements.namedItem('gender').value,
    averageScore: Number(form.elements.namedItem('averageScore').value), attendanceRate: Number(form.elements.namedItem('attendanceRate').value),
    status: form.elements.namedItem('status').value
  };
  const submit = form.querySelector('button[type=submit]');
  submit.disabled = true;
  try {
    const edit = editingId;
    if (edit) await api(`/api/students/${encodeURIComponent(edit)}`, { method: 'PATCH', body: payload });
    else await api('/api/students', { method: 'POST', body: { ...payload, classId: getClassId() } });
    closeStudentForm();
    toast(edit ? 'Đã cập nhật học sinh' : 'Đã thêm học sinh');
    await onChange();
  } catch (error) { toast(error.message); }
  finally { submit.disabled = false; }
}
