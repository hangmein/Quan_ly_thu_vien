// controllers/staffController.js — Mục 4: Quản lý nhân viên
const { sql, getPool } = require('../config/db');
const bcrypt = require('bcryptjs');

// GET /api/staff
async function getStaff(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT nv.*,
             (SELECT COUNT(*) FROM phieu_muon pm WHERE pm.id_nhan_vien=nv.id_nhan_vien) AS so_phieu_lap
      FROM nhan_vien nv ORDER BY nv.ho_ten
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// POST /api/staff — Tiến trình 4.1: Thêm nhân sự (tự tạo tài khoản)
async function createStaff(req, res) {
  const { ho_ten, sdt, email, chuc_vu, ngay_vao_lam, ten_dang_nhap, mat_khau } = req.body;
  
  // Kiểm tra thông tin bắt buộc đầu vào
  if (!ho_ten || !ten_dang_nhap || !mat_khau) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
  }

  // --- 1. CHỐT CHẶN KIỂM TRA NGÀY VÀO LÀM ---
    const today = new Date().toISOString().split('T')[0];
    const nvl = ngay_vao_lam || today;

    // 1. Chặn tương lai (Nếu thư viện quy định không được tạo trước tài khoản)
    if (nvl > today) {
      return res.status(400).json({ message: 'Lỗi: Ngày vào làm không được vượt quá ngày lập hiện tại!' });
    }

    // 2. Chặn quá khứ quá xa (Ví dụ: Thư viện của bạn thành lập năm 2024, không thể có ai vào làm trước năm 2024)
    const libraryFoundingDate = '2025-05-05'; 
    if (nvl < libraryFoundingDate) {
      return res.status(400).json({ message: 'Lỗi: Ngày vào làm không hợp lệ (Trước thời điểm thư viện thành lập)!' });
    }

  try {
    const pool = await getPool();

    // --- 2. CHỐT CHẶN: KIỂM TRA TRÙNG TÊN ĐĂNG NHẬP ---
    const checkUser = await pool.request()
      .input('u', sql.NVarChar, ten_dang_nhap)
      .query('SELECT TOP 1 id_tai_khoan FROM tai_khoan WHERE ten_dang_nhap = @u');
      
    if (checkUser.recordset.length > 0) {
      return res.status(409).json({ message: 'Lỗi: Tên đăng nhập này đã tồn tại trong hệ thống!' });
    }

    // --- 3. CHỐT CHẶN: KIỂM TRA TRÙNG EMAIL NHÂN VIÊN (Nếu có nhập) ---
    if (email) {
      const checkEmail = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT TOP 1 id_nhan_vien FROM nhan_vien WHERE email = @email');
        
      if (checkEmail.recordset.length > 0) {
        return res.status(409).json({ message: 'Lỗi: Địa chỉ Email này đã được một nhân viên khác sử dụng!' });
      }
    }

    // --- 4. TIẾN HÀNH TẠO TÀI KHOẢN (Khi mọi điều kiện đã an toàn) ---
    const hash = await bcrypt.hash(mat_khau, 10);
    const tkR = await pool.request()
      .input('u', sql.NVarChar, ten_dang_nhap)
      .input('h', sql.NVarChar, hash)
      .query(`INSERT INTO tai_khoan (ten_dang_nhap,mat_khau_hash,id_vai_tro)
              OUTPUT INSERTED.id_tai_khoan VALUES (@u,@h,2)`); // Vai trò 2 = Thủ thư
              
    const idTK = tkR.recordset[0].id_tai_khoan;

    // --- 5. TẠO HỒ SƠ NHÂN VIÊN ---
    const r = await pool.request()
      .input('idtk',  sql.Int,      idTK)
      .input('ht',    sql.NVarChar, ho_ten)
      .input('sdt',   sql.NVarChar, sdt  || null)
      .input('email', sql.NVarChar, email || null)
      .input('cv',    sql.NVarChar, chuc_vu || 'Thủ thư')
      .input('nvl',   sql.Date,     nvl) // Sử dụng biến nvl đã qua kiểm duyệt ở trên
      .query(`INSERT INTO nhan_vien (id_tai_khoan,ho_ten,sdt,email,chuc_vu,ngay_vao_lam)
              OUTPUT INSERTED.id_nhan_vien VALUES (@idtk,@ht,@sdt,@email,@cv,@nvl)`);
              
    res.status(201).json({ message: 'Thêm nhân viên thành công', id_nhan_vien: r.recordset[0].id_nhan_vien });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
}
// PUT /api/staff/:id — Tiến trình 4.2: Cập nhật
async function updateStaff(req, res) {
  const { ho_ten, sdt, email, chuc_vu } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id',    sql.Int,      req.params.id)
      .input('ht',    sql.NVarChar, ho_ten)
      .input('sdt',   sql.NVarChar, sdt   || null)
      .input('email', sql.NVarChar, email || null)
      .input('cv',    sql.NVarChar, chuc_vu)
      .query(`UPDATE nhan_vien SET ho_ten=@ht,sdt=@sdt,email=@email,chuc_vu=@cv WHERE id_nhan_vien=@id`);
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// PATCH /api/staff/:id/nghi-viec — Tiến trình 4.5: Nghỉ việc (vô hiệu hóa TK, giữ lịch sử)
async function retire(req, res) {
  try {
    const pool = await getPool();
    // Lấy id_tai_khoan của nhân viên
    const nv = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT id_tai_khoan FROM nhan_vien WHERE id_nhan_vien=@id');
    if (!nv.recordset.length) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    // Vô hiệu hóa tài khoản (KHÔNG xóa — phải giữ lịch sử phiếu mượn)
    await pool.request()
      .input('idtk', sql.Int, nv.recordset[0].id_tai_khoan)
      .query(`UPDATE tai_khoan SET trang_thai='locked' WHERE id_tai_khoan=@idtk`);
    res.json({ message: 'Đã vô hiệu hóa tài khoản nhân viên' });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

module.exports = { getStaff, createStaff, updateStaff, retire };
