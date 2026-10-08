import { api, withClass } from '../api/client.js';
import { escapeHtml, toast } from '../utils.js';
export async function loadContent(classId) {
  const [templates, reports, messages] = await Promise.all([
    api(withClass('/api/templates', classId)), api(withClass('/api/reports', classId)), api(withClass('/api/messages', classId))
  ]);
  document.getElementById('templateGrid').innerHTML = templates.map(t => `
    <div class="template-card" data-prompt="${escapeHtml(t.prompt)}"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.description)}</small></div>`).join('');
  document.getElementById('reportGrid').innerHTML = reports.map(r => `
    <div class="report-card" role="button" tabindex="0" data-report="${escapeHtml(r.id)}"><div class="report-icon">${escapeHtml(r.icon)}</div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.description)}</p><div class="report-meta"><span>${escapeHtml(r.meta)}</span><span>Xem mô tả →</span></div></div>`).join('');
  document.getElementById('messageHistory').innerHTML = messages.length ? messages.map(m => `<div><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.description)}</small></div>`).join('') : '<p class="muted">Chưa có tin nhắn</p>';
  document.getElementById('reportGrid').onclick = e => {
    if (e.target.closest('[data-report]')) toast('Báo cáo là mẫu demo; chưa có chức năng xuất tệp.');
  };
}
