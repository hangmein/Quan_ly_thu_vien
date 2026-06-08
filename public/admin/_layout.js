// admin/_layout.js — Inject sidebar + topbar vào mọi trang admin
(function() {
  if (!Auth.requireStaff()) return;
  const user = Auth.getUser();
  const isAdmin = user?.vai_tro === 'admin';

  // Lấy tên trang hiện tại
  const page = location.pathname.split('/').pop().replace('.html','');
  const titles = {
    dashboard: 'TỔNG QUAN',
    books:     'QUẢN LÝ SÁCH',
    readers:   'QUẢN LÝ ĐỘC GIẢ',
    staff:     'QUẢN LÝ NHÂN VIÊN',
    borrow:    'MƯỢN / TRẢ SÁCH',
    fines:     'XỬ LÝ PHẠT',
    catalog:   'DANH MỤC',
    stats:     'THỐNG KÊ BÁO CÁO',
    history:   'LỊCH SỬ LẬP PHIẾU',
    duesoon:   'NHẮC SÁCH ĐẾN HẠN',
    violators: 'ĐỘC GIẢ VI PHẠM',
  };

  const navItems = [
    { id:'dashboard', icon:'◈', label:'Tổng quan',        section:'TỔNG QUAN' },
    { id:'books',     icon:'✦', label:'Quản lý sách',     section:'QUẢN LÝ' },
    { id:'readers',   icon:'◉', label:'Quản lý độc giả',  section:'' },
    { id:'staff',     icon:'◎', label:'Quản lý nhân viên',section:'', adminOnly:true },
    { id:'borrow',    icon:'⚜', label:'Mượn / Trả sách', section:'NGHIỆP VỤ' },
    { id:'duesoon',   icon:'⏰', label:'Nhắc đến hạn',     section:'' },
    { id:'fines',     icon:'❋', label:'Xử lý phạt',       section:'' },
    { id:'history',   icon:'⌬', label:'Lịch sử lập phiếu',section:'' },
    { id:'violators', icon:'⚠', label:'Độc giả vi phạm',  section:'' },
    { id:'catalog',   icon:'❦', label:'Danh mục',         section:'HỆ THỐNG', adminOnly:true },
    { id:'stats',     icon:'⚛', label:'Thống kê',         section:'' },
  ];

  const navHTML = navItems
    .filter(n => !n.adminOnly || isAdmin)
    .map(n => {
      const sec = n.section ? `<div class="nav-sec">${n.section}</div>` : '';
      const active = n.id === page ? ' active' : '';
      return `${sec}<a href="/admin/${n.id}.html" class="nav-item${active}"><span class="ni">${n.icon}</span>${n.label}</a>`;
    }).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <div id="layout-wrap">
      <aside class="sidebar">
        <div class="sb-logo">
          <div class="sb-name">BIBLIOTHECA</div>
          <div class="sb-role">${user?.vai_tro === 'admin' ? 'Quản trị viên' : 'Thủ thư'}</div>
        </div>
        <nav class="sb-nav">${navHTML}</nav>
        <div class="sb-foot">
          <div class="sb-user">
            <div class="sb-avatar">${(user?.ten_dang_nhap||'A')[0].toUpperCase()}</div>
            <div>
              <div class="sb-uname">${user?.ten_dang_nhap||''}</div>
              <div class="sb-urole">${user?.vai_tro||''}</div>
            </div>
          </div>
          <button class="sb-logout" onclick="doLogout()">ĐĂNG XUẤT</button>
        </div>
      </aside>
      <div class="main-wrap">
        <header class="topbar">
          <div class="topbar-title">${titles[page]||''}</div>
          <div class="topbar-actions" id="topbar-actions">
            <a href="/" class="tb-btn">← Trang chủ</a>
          </div>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>
  `);

  // CSS layout
  const s = document.createElement('style');
  s.textContent = `
    body{margin:0;overflow-x:hidden}
    #layout-wrap{display:flex;min-height:100vh}
    .sidebar{width:255px;background:#14100c;border-right:1px solid rgba(201,169,110,.18);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:50}
    .sb-logo{padding:24px 26px;border-bottom:1px solid rgba(201,169,110,.18)}
    .sb-name{font-family:'Cinzel',serif;font-weight:800;font-size:16px;letter-spacing:3px;color:#e8dcc4}
    .sb-name::before{content:'◆  ';color:#c9a96e;font-size:11px}
    .sb-role{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:13px;color:#8a7a60;margin-top:3px}
    .sb-nav{flex:1;padding:12px 0;overflow-y:auto}
    .nav-sec{padding:14px 26px 5px;font-family:'Cinzel',serif;font-size:9px;letter-spacing:3px;color:#5a4d3a}
    .nav-item{display:flex;align-items:center;gap:11px;padding:11px 26px;color:#8a7a60;cursor:pointer;transition:all .25s;font-family:'Inter',sans-serif;font-size:13px;border-left:2px solid transparent;text-decoration:none}
    .nav-item:hover{color:#e8dcc4;background:rgba(201,169,110,.05);border-left-color:rgba(201,169,110,.36)}
    .nav-item.active{color:#c9a96e;background:rgba(201,169,110,.12);border-left-color:#c9a96e}
    .ni{font-size:15px;width:17px;text-align:center}
    .sb-foot{padding:18px 26px;border-top:1px solid rgba(201,169,110,.18)}
    .sb-user{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    .sb-avatar{width:32px;height:32px;background:rgba(201,169,110,.15);border:1px solid rgba(201,169,110,.36);border-radius:50%;display:grid;place-items:center;color:#c9a96e;font-size:13px;font-family:'Cinzel',serif}
    .sb-uname{font-size:13px;color:#e8dcc4;font-weight:500}
    .sb-urole{font-size:11px;color:#8a7a60}
    .sb-logout{width:100%;padding:9px;background:transparent;border:1px solid rgba(201,169,110,.18);color:#8a7a60;font-family:'Cinzel',serif;font-size:10px;letter-spacing:3px;cursor:pointer;transition:all .3s}
    .sb-logout:hover{border-color:#c97272;color:#c97272}
    .main-wrap{margin-left:255px;flex:1;min-height:100vh;display:flex;flex-direction:column}
    .topbar{height:62px;background:#14100c;border-bottom:1px solid rgba(201,169,110,.18);padding:0 30px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:40}
    .topbar-title{font-family:'Cinzel',serif;font-size:15px;letter-spacing:3px;color:#e8dcc4;font-weight:600}
    .topbar-actions{display:flex;gap:10px;align-items:center}
    .tb-btn{padding:8px 18px;background:transparent;border:1px solid rgba(201,169,110,.18);color:#8a7a60;font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;cursor:pointer;transition:all .3s;text-decoration:none}
    .tb-btn:hover{border-color:#c9a96e;color:#c9a96e}
    .tb-btn.primary{background:#c9a96e;color:#0a0806;border-color:#c9a96e;font-weight:700}
    .tb-btn.primary:hover{background:#e6c989}
    .content{flex:1;padding:26px 30px;overflow-y:auto}
    /* Cards */
    .card{background:#14100c;border:1px solid rgba(201,169,110,.18);padding:22px;margin-bottom:18px}
    .card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(201,169,110,.12)}
    .card-title{font-family:'Cinzel',serif;font-size:12px;letter-spacing:3px;color:#e8dcc4;font-weight:600}
    /* Stats */
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
    .stat-card{background:#14100c;border:1px solid rgba(201,169,110,.18);padding:22px;transition:all .3s}
    .stat-card:hover{border-color:rgba(201,169,110,.36);transform:translateY(-3px)}
    .stat-label{font-family:'Cinzel',serif;font-size:9px;letter-spacing:3px;color:#8a7a60;margin-bottom:10px}
    .stat-val{font-family:'Cormorant Garamond',serif;font-size:42px;color:#e6c989;font-weight:500;line-height:1;margin-bottom:6px}
    .stat-note{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:13px;color:#8a7a60}
    .stat-note.up{color:#8fc972}.stat-note.dn{color:#c97272}
    /* Table */
    table{width:100%;border-collapse:collapse}
    th{font-family:'Cinzel',serif;font-size:9px;letter-spacing:2px;color:#c9a96e;padding:10px 12px;text-align:left;border-bottom:1px solid rgba(201,169,110,.18)}
    td{padding:11px 12px;font-size:13px;border-bottom:1px solid rgba(201,169,110,.06);vertical-align:middle;color:#e8dcc4}
    tr:hover td{background:rgba(201,169,110,.03)}
    /* Inputs */
    .inp{padding:9px 13px;background:#1c1612;border:1px solid rgba(201,169,110,.18);color:#e8dcc4;font-family:'Inter',sans-serif;font-size:13px;outline:none;transition:border .3s}
    .inp:focus{border-color:#c9a96e}
    .inp::placeholder{color:#5a4d3a}
    select.inp{cursor:pointer}
    /* Buttons */
    .btn-tbl{padding:5px 13px;background:transparent;border:1px solid rgba(201,169,110,.18);color:#8a7a60;font-family:'Cinzel',serif;font-size:9px;letter-spacing:1px;cursor:pointer;transition:all .25s;margin-right:4px}
    .btn-tbl:hover{border-color:#c9a96e;color:#c9a96e}
    .btn-tbl.danger:hover{border-color:#c97272;color:#c97272}
    /* Search bar */
    .search-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    /* Modal */
    .modal-back{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;align-items:center;justify-content:center}
    .modal-back.open{display:flex}
    .modal{background:#14100c;border:1px solid rgba(201,169,110,.36);width:500px;max-width:94vw;max-height:90vh;overflow-y:auto}
    .modal-hd{padding:22px 26px;border-bottom:1px solid rgba(201,169,110,.18);display:flex;justify-content:space-between;align-items:center}
    .modal-ttl{font-family:'Cinzel',serif;font-size:13px;letter-spacing:3px;color:#c9a96e}
    .modal-x{background:transparent;border:none;color:#8a7a60;cursor:pointer;font-size:18px;padding:2px 8px;transition:color .3s}
    .modal-x:hover{color:#c97272}
    .modal-bd{padding:26px}
    .modal-ft{padding:16px 26px;border-top:1px solid rgba(201,169,110,.18);display:flex;gap:10px;justify-content:flex-end}
    .fg{margin-bottom:16px}
    .fg label{display:block;font-family:'Cinzel',serif;font-size:9px;letter-spacing:3px;color:#c9a96e;margin-bottom:7px}
    .fg .inp{width:100%}
    .row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .modal-btn{padding:10px 24px;font-family:'Cinzel',serif;font-size:10px;letter-spacing:3px;cursor:pointer;transition:all .3s;border:1px solid rgba(201,169,110,.18);background:transparent;color:#8a7a60}
    .modal-btn:hover{border-color:#c9a96e;color:#c9a96e}
    .modal-btn.save{background:#c9a96e;color:#0a0806;border-color:#c9a96e;font-weight:700}
    .modal-btn.save:hover{background:#e6c989}
    .empty{text-align:center;padding:44px;color:#8a7a60;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:16px}
    @media(max-width:900px){.sidebar{transform:translateX(-100%)}.main-wrap{margin-left:0}.stat-grid{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(s);
})();

function doLogout() {
  Auth.clear();
  window.location = '/login.html';
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
