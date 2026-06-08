// js/api.js — Module gọi API dùng chung
const API = 'http://localhost:3000/api';

// ── AUTH ──────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('token'),
  getUser:  () => JSON.parse(localStorage.getItem('user') || 'null'),
  isLoggedIn: () => !!localStorage.getItem('token'),
  isAdmin: () => Auth.getUser()?.vai_tro === 'admin',
  isStaff: () => ['admin','librarian'].includes(Auth.getUser()?.vai_tro),

  save(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  requireLogin(redirectTo = '/login.html') {
    if (!Auth.isLoggedIn()) { window.location = redirectTo; return false; }
    return true;
  },
  requireStaff() {
    if (!Auth.isStaff()) { window.location = '/'; return false; }
    return true;
  }
};

// ── HTTP HELPER ────────────────────────────────────
async function http(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !window.location.pathname.includes('login')) {
    Auth.clear();
    window.location = '/login.html';
  }
  if (!res.ok) throw new Error(data.message || 'Lỗi máy chủ');

  return data;
}

const api = {
  get:    (path)        => http('GET',    path),
  post:   (path, body)  => http('POST',   path, body),
  put:    (path, body)  => http('PUT',    path, body),
  patch:  (path, body)  => http('PATCH',  path, body),
  delete: (path)        => http('DELETE', path),
};

// ── TOAST ──────────────────────────────────────────
function toast(msg, type = 'info') {
  const colors = { success: '#8fc972', error: '#c97272', info: '#c9a96e' };
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    padding:14px 20px;border-left:3px solid ${colors[type]};
    background:#14100c;color:#e8dcc4;font-family:'Cormorant Garamond',serif;
    font-size:15px;box-shadow:0 8px 24px rgba(0,0,0,.5);
    animation:slideIn .3s ease;min-width:260px;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── CONFIRM MODAL ──────────────────────────────────
function confirm2(msg) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;';
    backdrop.innerHTML = `
      <div style="background:#14100c;border:1px solid rgba(201,169,110,.36);padding:36px 40px;max-width:400px;text-align:center;">
        <p style="font-family:Cormorant Garamond,serif;font-size:17px;color:#e8dcc4;margin-bottom:28px;">${msg}</p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="cfm-yes" style="padding:10px 28px;background:#c9a96e;border:none;color:#0a0806;font-family:Cinzel,serif;font-size:11px;letter-spacing:3px;cursor:pointer;">XÁC NHẬN</button>
          <button id="cfm-no" style="padding:10px 28px;background:transparent;border:1px solid rgba(201,169,110,.36);color:#8a7a60;font-family:Cinzel,serif;font-size:11px;letter-spacing:3px;cursor:pointer;">HỦY</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#cfm-yes').onclick = () => { backdrop.remove(); resolve(true); };
    backdrop.querySelector('#cfm-no').onclick  = () => { backdrop.remove(); resolve(false); };
  });
}

// ── LOADING ────────────────────────────────────────
function setLoading(selector, on) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (on) { el.dataset.origText = el.textContent; el.textContent = 'Đang xử lý...'; el.disabled = true; }
  else     { el.textContent = el.dataset.origText || el.textContent; el.disabled = false; }
}

// ── FORMAT ─────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}
function fmtMoney(n) {
  return Number(n).toLocaleString('vi-VN') + ' ₫';
}
function statusBadge(s) {
  const map = {
    available: ['CÒN', '#8fc972'],
    borrowed:  ['HẾT', '#c97272'],
    active:    ['HOẠT ĐỘNG', '#8fc972'],
    locked:    ['KHÓA', '#c97272'],
    borrowing: ['ĐANG MƯỢN', '#c9a96e'],
    returned:  ['ĐÃ TRẢ', '#8fc972'],
    overdue:   ['QUÁ HẠN', '#c97272'],
    unpaid:    ['CHƯA THANH TOÁN', '#c97272'],
    paid:      ['ĐÃ THANH TOÁN', '#8fc972'],
    waiting:   ['CHỜ', '#72a0c9'],
  };
  const [label, color] = map[s] || [s, '#8a7a60'];
  return `<span style="padding:2px 9px;border-radius:20px;font-size:10px;font-family:Cinzel,serif;letter-spacing:1px;background:${color}22;color:${color};border:1px solid ${color}44">${label}</span>`;
}

// CSS chung inject 1 lần
if (!document.getElementById('api-style')) {
  const s = document.createElement('style');
  s.id = 'api-style';
  s.textContent = `@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`;
  document.head.appendChild(s);
}
