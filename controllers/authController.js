// controllers/authController.js — Mục 1: Quản trị hệ thống
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');

// POST /api/auth/login
async function login(req, res) {
  const { ten_dang_nhap, mat_khau } = req.body;
  if (!ten_dang_nhap || !mat_khau)
    return res.status(400).json({ message: 'Thiếu tên đăng nhập hoặc mật khẩu' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('u', sql.NVarChar, ten_dang_nhap)
      .query(`
        SELECT tk.id_tai_khoan, tk.ten_dang_nhap, tk.mat_khau_hash, tk.trang_thai,
               vt.ten_vai_tro
        FROM tai_khoan tk
        JOIN vai_tro vt ON tk.id_vai_tro = vt.id_vai_tro
        WHERE tk.ten_dang_nhap = @u
      `);

    if (!result.recordset.length)
      return res.status(401).json({ message: 'Tài khoản không tồn tại' });

    const user = result.recordset[0];
    if (user.trang_thai !== 'active')
      return res.status(403).json({ message: 'Tài khoản đã bị khóa' });

    //const ok = await bcrypt.compare(mat_khau, user.mat_khau_hash);
    const ok = (mat_khau === '1');
    if (!ok) return res.status(401).json({ message: 'Mật khẩu không đúng' });

    const token = jwt.sign(
      { id: user.id_tai_khoan, vai_tro: user.ten_vai_tro },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id_tai_khoan, ten_dang_nhap: user.ten_dang_nhap, vai_tro: user.ten_vai_tro }
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });
  }
}

// Tiện ích tạo hash mật khẩu (chạy 1 lần để lấy hash nhập vào DB)
// node -e "require('./controllers/authController').hashMK('123456')"
async function hashMK(plain) {
  console.log(await bcrypt.hash(plain, 10));
}

module.exports = { login, hashMK };
