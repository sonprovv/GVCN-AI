import { api } from '../api/client.js';
import { escapeHtml, toast } from '../utils.js';

let showPage, classGetter;
export function initAssistant(navigate, getClassId) {
  showPage = navigate;
  classGetter = getClassId;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-prompt]');
    if (el) sendPrompt(el.dataset.prompt.replaceAll('12A5', classGetter()));
  });
  document.getElementById('chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    if (input.value.trim()) sendPrompt(input.value.trim());
  });
}
async function sendPrompt(prompt) {
  document.getElementById('quickModal').classList.remove('show');
  showPage('assistant');
  const chat = document.getElementById('chat'), input = document.getElementById('chatInput');
  input.value = '';
  chat.insertAdjacentHTML('beforeend', `<div class="bubble user"><p>${escapeHtml(prompt)}</p></div>`);
  const reply = document.createElement('div');
  reply.className = 'bubble ai';
  reply.innerHTML = '<strong>GVCN 360 (demo)</strong><p>Đang xử lý...</p>';
  chat.append(reply);
  chat.scrollTop = chat.scrollHeight;
  try {
    const result = await api('/api/assistant/chat', { method: 'POST', body: { prompt } });
    reply.querySelector('p').textContent = result.reply;
  } catch (error) { reply.querySelector('p').textContent = error.message; toast(error.message); }
  chat.scrollTop = chat.scrollHeight;
}
