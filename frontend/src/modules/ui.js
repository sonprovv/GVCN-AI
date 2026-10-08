export function initUI({ onClassChange, onSearch }) {
  const navItems = [...document.querySelectorAll('.nav-item[data-page]')];
  function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');
    navItems.forEach(item => item.classList.toggle('active', item.dataset.page === page));
    document.getElementById('sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  navItems.forEach(item => item.addEventListener('click', () => showPage(item.dataset.page)));
  // Delegation also handles dynamically inserted "Xem hồ sơ" buttons.
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-page-link]');
    if (link) showPage(link.dataset.pageLink);
  });
  const modal = document.getElementById('quickModal');
  document.querySelectorAll('[data-open="quickModal"]').forEach(b => b.addEventListener('click', () => modal.classList.add('show')));
  document.querySelector('.close-modal').addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
  const theme = localStorage.getItem('gvcn-theme');
  if (theme === 'dark') document.body.classList.add('dark');
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('gvcn-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });
  document.getElementById('mobileMenu').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('classSelect').addEventListener('change', e => onClassChange(e.target.value));
  document.getElementById('globalSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') { showPage('students'); onSearch(e.target.value); }
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); document.getElementById('globalSearch').focus();
    }
  });
  return showPage;
}
