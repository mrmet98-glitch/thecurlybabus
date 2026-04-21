// Shared utilities
const API_BASE = '/api';

function getPassword() { return localStorage.getItem('btpwd') || ''; }
function setPassword(p) { localStorage.setItem('btpwd', p); }
function clearAuth() { localStorage.removeItem('btpwd'); window.location.href = '/'; }

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Password': getPassword() }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (res.status === 401) { clearAuth(); return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, type = 'success') {
  let container = document.getElementById('toasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toasts';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function statusBadge(status) {
  const labels = { confirmed: 'Confirmed', maybe: 'Maybe', cant_make_it: "Can't Make It", adi: '? Adi' };
  const label = labels[status] || status;
  return `<span class="badge badge-${status}">${label}</span>`;
}

function groupTags(groups) {
  if (!groups || !groups.length) return '<span class="text-muted text-xs">—</span>';
  return groups.map(g => `<span class="group-tag" style="background:${g.color}22;color:${g.color};border:1px solid ${g.color}44">${g.name}</span>`).join('');
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

function confirm(msg) {
  return window.confirm(msg);
}

// Sidebar active link
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
});

function checkAuth() {
  if (!getPassword() && window.location.pathname !== '/') {
    window.location.href = '/';
  }
}

function navHTML() {
  return `
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-text">Bachelor HQ</div>
      <div class="logo-sub">TRIP OPS DASHBOARD</div>
    </div>
    <div class="nav-section">
      <span class="nav-label">Overview</span>
      <a href="/dashboard.html" class="nav-item"><span class="nav-icon">⚡</span> Dashboard</a>
    </div>
    <div class="nav-section">
      <span class="nav-label">People</span>
      <a href="/guests.html" class="nav-item"><span class="nav-icon">👤</span> Guests</a>
      <a href="/groups.html" class="nav-item"><span class="nav-icon">🏷️</span> Groups & Teams</a>
    </div>
    <div class="nav-section">
      <span class="nav-label">Travel</span>
      <a href="/flights.html" class="nav-item"><span class="nav-icon">✈️</span> Flight Board</a>
      <a href="/coordination.html" class="nav-item"><span class="nav-icon">🗺️</span> Coordination</a>
    </div>
    <div class="nav-section">
      <span class="nav-label">Trip</span>
      <a href="/attendance.html" class="nav-item"><span class="nav-icon">📅</span> Attendance</a>
      <a href="/itinerary.html" class="nav-item"><span class="nav-icon">🗓️</span> Itinerary</a>
      <a href="/housing.html" class="nav-item"><span class="nav-icon">🏠</span> Housing</a>
      <a href="/rooms.html" class="nav-item"><span class="nav-icon">🛏️</span> Rooms</a>
    </div>
    <div class="nav-section">
      <span class="nav-label">Finance</span>
      <a href="/payments.html" class="nav-item"><span class="nav-icon">💰</span> Payments</a>
    </div>
    <div class="nav-section">
      <span class="nav-label">Settings</span>
      <a href="/admin.html" class="nav-item"><span class="nav-icon">⚙️</span> Admin</a>
    </div>
  </div>`;
}

function renderNav() {
  const placeholder = document.getElementById('nav-placeholder');
  if (placeholder) placeholder.outerHTML = navHTML();
}
