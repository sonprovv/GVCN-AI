import { api, withClass } from '../api/client.js';
import { escapeHtml } from '../utils.js';
export async function loadLearning(classId) {
  const data = await api(withClass('/api/subjects', classId));
  document.getElementById('barChart').innerHTML = data.length ? data.map(s => `
    <div class="bar-row"><span>${escapeHtml(s.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, s.average * 10))}%"></div></div><strong>${s.average.toFixed(1)}</strong></div>`).join('') : '<p class="muted">Chưa có dữ liệu môn học</p>';
}
