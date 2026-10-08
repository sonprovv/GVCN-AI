import { api } from './api/client.js';
import { ensureAuthenticated } from './auth.js';
import { toast, escapeHtml } from './utils.js';
import { initUI } from './modules/ui.js';
import { initDashboard, loadDashboard } from './modules/dashboard.js';
import { initStudents, loadStudents } from './modules/students.js';
import { initAttendance, loadAttendance } from './modules/attendance.js';
import { loadLearning } from './modules/learning.js';
import { loadContent } from './modules/content.js';
import { initAssistant } from './modules/assistant.js';

const appState = { classId: '12A5' };
const currentClassId = () => appState.classId;
async function refreshAll() {
  const results = await Promise.allSettled([
    loadDashboard(), loadStudents(), loadAttendance(), loadLearning(appState.classId), loadContent(appState.classId)
  ]);
  for (const result of results) if (result.status === 'rejected') {
    console.error(result.reason);
    toast(result.reason.message || 'Không thể tải dữ liệu');
  }
}
async function start() {
  initDashboard(currentClassId);
  initStudents(currentClassId, refreshAll);
  initAttendance(currentClassId, loadDashboard);
  const showPage = initUI({
    onClassChange: async id => { appState.classId = id; await refreshAll(); },
    onSearch: async query => {
      document.getElementById('studentSearch').value = query;
      try { await loadStudents(); } catch (e) { toast(e.message); }
    }
  });
  initAssistant(showPage, currentClassId);
  try {
    const classes = await api('/api/classes');
    if (!classes.length) throw new Error('Không tìm thấy lớp học');
    const select = document.getElementById('classSelect');
    select.innerHTML = classes.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} · ${escapeHtml(c.academicYear)}</option>`).join('');
    appState.classId = classes[0].id;
    select.value = appState.classId;
    await refreshAll();
  } catch (error) {
    console.error(error);
    const banner = document.createElement('div');
    banner.className = 'api-error';
    banner.textContent = 'Không kết nối được backend. Hãy chạy `npm start` tại thư mục gốc, sau đó mở http://127.0.0.1:3000. Chi tiết: ' + error.message;
    document.querySelector('.page.active').prepend(banner);
  }
}
ensureAuthenticated().then(start).catch(error => {
  console.error(error);
  document.body.classList.remove('auth-checking');
  const banner = document.createElement('div');
  banner.className = 'api-error';
  banner.textContent = 'Không thể kết nối GVCN 360: ' + error.message;
  document.body.prepend(banner);
});
