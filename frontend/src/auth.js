// Login uses HttpOnly cookie. No password or database URL is stored in the browser.
export async function ensureAuthenticated() {
  const response = await fetch('/api/auth/status', { cache: 'no-store' });
  if (!response.ok) throw new Error('Không kết nối được máy chủ đăng nhập');
  const status = await response.json();
  if (!status.required || status.authenticated) {
    document.body.classList.remove('auth-checking');
    setupLogout(status.required);
    return;
  }
  const overlay = document.createElement('section');
  overlay.className = 'login-gate';
  overlay.innerHTML = `<form class="login-card" id="loginForm" autocomplete="on">
      <span class="login-brand">G</span><h1>GVCN 360</h1>
      <p>Đăng nhập để xem và cập nhật dữ liệu lớp học dùng chung trên máy chủ.</p>
      <label for="loginPassword">Mật khẩu truy cập</label>
      <input id="loginPassword" name="password" type="password" autocomplete="current-password" required minlength="1" autofocus />
      <button class="primary" type="submit">Đăng nhập</button>
      <p role="alert" id="loginError" class="login-error" aria-live="polite"></p>
      <small>Chỉ giáo viên hoặc người được cấp quyền mới có thể truy cập.</small>
    </form>`;
  document.body.appendChild(overlay);
  document.body.classList.remove('auth-checking');
  await new Promise(resolve => {
    const form = overlay.querySelector('form');
    const error = overlay.querySelector('#loginError');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button');
      button.disabled = true;
      error.textContent = '';
      try {
        const result = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ password: form.elements.password.value })
        });
        const json = await result.json();
        if (!result.ok) throw new Error(json.error?.message || 'Đăng nhập thất bại');
        form.elements.password.value = '';
        overlay.remove();
        setupLogout(true);
        resolve();
      } catch (e) { error.textContent = e.message; }
      finally { button.disabled = false; }
    });
  });
}
function setupLogout(show) {
  const btn = document.querySelector('#logoutButton');
  if (!btn) return;
  btn.hidden = !show;
  btn.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); }
    finally { window.location.reload(); }
  }, { once: true });
}
