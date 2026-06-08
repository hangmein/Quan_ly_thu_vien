// controllers/readerController.js — Mục 3: Quản lý độc giả
const { sql, getPool } = require('../config/db');
const bcrypt = require('bcryptjs');

// GET /api/readers?keyword=&trang_thai=
async function getReaders(req, res) {
  const { keyword, trang_thai } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request();
    let where = 'WHERE 1=1';
    if (keyword)     { where += ' AND (dg.ho_ten LIKE @kw OR dg.email LIKE @kw OR dg.sdt LIKE @kw)'; r.input('kw', sql.NVarChar, `%${keyword}%`); }
    if (trang_thai)  { where += ' AND dg.trang_thai = @tt'; r.input('tt', sql.NVarChar, trang_thai); }
    const result = await r.query(`
      SELECT dg.*, gt.ten_goi,
             (SELECT COUNT(*) FROM phieu_muon pm WHERE pm.id_doc_gia=dg.id_doc_gia AND pm.trang_thai IN ('borrowing','overdue')) AS dang_muon
      FROM doc_gia dg
      JOIN goi_the gt ON dg.id_goi_the = gt.id_goi_the
      ${where}
      ORDER BY dg.ho_ten
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/readers/:id
async function getReaderById(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT dg.*, gt.ten_goi, gt.so_sach_toi_da, gt.so_ngay_muon
        FROM doc_gia dg JOIN goi_the gt ON dg.id_goi_the=gt.id_goi_the
        WHERE dg.id_doc_gia=@id
      `);
    if (!result.recordset.length) return res.status(404).json({ message: 'Không tìm thấy độc giả' });
    res.json(result.recordset[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// POST /api/readers — Tiến trình 3.1: Đăng ký thẻ
async function createReader(req, res) {
  const { ho_ten, sdt, email, dia_chi, id_goi_the, ten_dang_nhap, mat_khau } = req.body;
  if (!ho_ten || !id_goi_the) return res.status(400).json({ message: 'Thiếu họ tên hoặc gói thẻ' });
  try {
    const pool = await getPool();
    const today     = new Date().toISOString().split('T')[0];
    const nextYear  = new Date(new Date().setFullYear(new Date().getFullYear()+1)).toISOString().split('T')[0];

    // --- 1. CHỐT CHẶN KIỂM TRA TRÙNG EMAIL ---
    if (email) {
      const checkEmail = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT TOP 1 id_doc_gia FROM doc_gia WHERE email = @email');
        
      if (checkEmail.recordset.length > 0) {
        return res.status(409).json({ message: 'Lỗi: Địa chỉ Email này đã được đăng ký cho một độc giả khác!' });
      }
    }

    // --- 2. CHỐT CHẶN KIỂM TRA TRÙNG TÊN ĐĂNG NHẬP (Khuyên dùng) ---
    if (ten_dang_nhap) {
      const checkUsername = await pool.request()
        .input('u', sql.NVarChar, ten_dang_nhap)
        .query('SELECT TOP 1 id_tai_khoan FROM tai_khoan WHERE ten_dang_nhap = @u');
        
      if (checkUsername.recordset.length > 0) {
        return res.status(409).json({ message: 'Lỗi: Tên đăng nhập này đã có người sử dụng!' });
      }
    }
    // tc 15

    // Tạo tài khoản đăng nhập nếu có thông tin
    let idTK = null;
    if (ten_dang_nhap && mat_khau) {
      const hash = await bcrypt.hash(mat_khau, 10);
      const tkR  = await pool.request()
        .input('u', sql.NVarChar, ten_dang_nhap)
        .input('h', sql.NVarChar, hash)
        .query(`INSERT INTO tai_khoan (ten_dang_nhap,mat_khau_hash,id_vai_tro)
                OUTPUT INSERTED.id_tai_khoan VALUES (@u,@h,3)`);
      idTK = tkR.recordset[0].id_tai_khoan;
    }

    const r = await pool.request()
      .input('idtk',   sql.Int,      idTK)
      .input('igt',    sql.Int,      id_goi_the)
      .input('ht',     sql.NVarChar, ho_ten)
      .input('sdt',    sql.NVarChar, sdt  || null)
      .input('email',  sql.NVarChar, email || null)
      .input('diachi', sql.NVarChar, dia_chi || null)
      .input('ndk',    sql.Date,     today)
      .input('nhh',    sql.Date,     nextYear)
      .query(`INSERT INTO doc_gia (id_tai_khoan,id_goi_the,ho_ten,sdt,email,dia_chi,ngay_dang_ky,ngay_het_han)
              OUTPUT INSERTED.id_doc_gia VALUES (@idtk,@igt,@ht,@sdt,@email,@diachi,@ndk,@nhh)`);
    res.status(201).json({ message: 'Đăng ký thẻ thành công', id_doc_gia: r.recordset[0].id_doc_gia });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// PUT /api/readers/:id — Tiến trình 3.2: Cập nhật
async function updateReader(req, res) {
  const { ho_ten, sdt, email, dia_chi, id_goi_the } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id',    sql.Int,      req.params.id)
      .input('ht',    sql.NVarChar, ho_ten)
      .input('sdt',   sql.NVarChar, sdt   || null)
      .input('email', sql.NVarChar, email || null)
      .input('dc',    sql.NVarChar, dia_chi || null)
      .input('igt',   sql.Int,      id_goi_the)
      .query(`UPDATE doc_gia SET ho_ten=@ht,sdt=@sdt,email=@email,dia_chi=@dc,id_goi_the=@igt WHERE id_doc_gia=@id`);
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// PATCH /api/readers/:id/gia-han — Tiến trình 3.3: Gia hạn thẻ
async function renewCard(req, res) {
  const { so_thang = 12 } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id',      sql.Int, req.params.id)
      .input('thang',   sql.Int, parseInt(so_thang))
      .query(`UPDATE doc_gia SET ngay_het_han = DATEADD(MONTH,@thang,ISNULL(ngay_het_han,GETDATE()))
              WHERE id_doc_gia=@id`);
    res.json({ message: `Đã gia hạn thẻ thêm ${so_thang} tháng` });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// PATCH /api/readers/:id/khoa-the — Tiến trình 3.4: Khóa/mở thẻ
async function toggleCard(req, res) {
  const { trang_thai } = req.body; // 'active' | 'locked'
  try {
    const pool = await getPool();
    // Kiểm tra còn sách đang mượn không (nghiệp vụ quan trọng)
    if (trang_thai === 'locked') {
      const chk = await pool.request()
        .input('id', sql.Int, req.params.id)
        .query(`SELECT COUNT(*) AS cnt FROM phieu_muon WHERE id_doc_gia=@id AND trang_thai IN ('borrowing','overdue')`);
      if (chk.recordset[0].cnt > 0)
        return res.status(400).json({ message: 'Không thể khóa! Độc giả đang có sách chưa trả' });
    }
    await pool.request()
      .input('id', sql.Int,      req.params.id)
      .input('tt', sql.NVarChar, trang_thai)
      .query(`UPDATE doc_gia SET trang_thai=@tt WHERE id_doc_gia=@id`);
    res.json({ message: trang_thai === 'locked' ? 'Đã khóa thẻ' : 'Đã mở thẻ' });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// DELETE /api/readers/:id — Xóa độc giả (chỉ khi không còn ràng buộc)
async function deleteReader(req, res) {
  const id = req.params.id;
  try {
    const pool = await getPool();
    const chk = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT COUNT(*) AS cnt FROM phieu_muon
              WHERE id_doc_gia=@id AND trang_thai IN ('borrowing','overdue')`);
    if (chk.recordset[0].cnt > 0)
      return res.status(400).json({ message: 'Không thể xóa: độc giả đang có sách chưa trả' });

    const chk2 = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT COUNT(*) AS cnt FROM phat
              WHERE id_doc_gia=@id AND trang_thai_thanh_toan='unpaid'`);
    if (chk2.recordset[0].cnt > 0)
      return res.status(400).json({ message: 'Không thể xóa: độc giả còn phạt chưa thanh toán' });

    const rd = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT id_tai_khoan FROM doc_gia WHERE id_doc_gia=@id');
    if (!rd.recordset.length) return res.status(404).json({ message: 'Không tìm thấy độc giả' });
    const idTK = rd.recordset[0].id_tai_khoan;

    await pool.request().input('id', sql.Int, id)
      .query('DELETE FROM doc_gia WHERE id_doc_gia=@id');

    if (idTK) {
      await pool.request().input('tk', sql.Int, idTK)
        .query('DELETE FROM tai_khoan WHERE id_tai_khoan=@tk');
    }
      
    res.json({ message: 'Đã xóa độc giả' });
  } catch (err) {
    res.status(500).json({ message: 'Không thể xóa (còn dữ liệu liên quan): ' + err.message });
  }
}

// GET /api/readers-vi-pham — Thống kê độc giả vi phạm (quá hạn hoặc còn phạt)
async function getViolators(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT dg.id_doc_gia, dg.ho_ten, dg.sdt, dg.email, dg.trang_thai, gt.ten_goi,
             (SELECT COUNT(*) FROM phieu_muon pm WHERE pm.id_doc_gia=dg.id_doc_gia AND pm.trang_thai='overdue') AS so_phieu_qua_han,
             (SELECT COUNT(*) FROM phat p WHERE p.id_doc_gia=dg.id_doc_gia AND p.trang_thai_thanh_toan='unpaid') AS so_phat_chua_tra,
             (SELECT ISNULL(SUM(p.so_tien),0) FROM phat p WHERE p.id_doc_gia=dg.id_doc_gia AND p.trang_thai_thanh_toan='unpaid') AS tong_tien_phat
      FROM doc_gia dg
      JOIN goi_the gt ON dg.id_goi_the=gt.id_goi_the
      WHERE EXISTS (SELECT 1 FROM phieu_muon pm WHERE pm.id_doc_gia=dg.id_doc_gia AND pm.trang_thai='overdue')
         OR EXISTS (SELECT 1 FROM phat p WHERE p.id_doc_gia=dg.id_doc_gia AND p.trang_thai_thanh_toan='unpaid')
      ORDER BY tong_tien_phat DESC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/readers/:id/lich-su — Quá trình hoạt động của 1 độc giả
async function getReaderHistory(req, res) {
  const id = req.params.id;
  try {
    const pool = await getPool();
    // Thông tin độc giả
    const info = await pool.request().input('id', sql.Int, id)
      .query(`SELECT dg.*, gt.ten_goi, gt.so_sach_toi_da, gt.so_ngay_muon
              FROM doc_gia dg JOIN goi_the gt ON dg.id_goi_the=gt.id_goi_the
              WHERE dg.id_doc_gia=@id`);
    if (!info.recordset.length) return res.status(404).json({ message: 'Không tìm thấy độc giả' });

    // Lịch sử mượn
    const borrows = await pool.request().input('id', sql.Int, id)
      .query(`SELECT pm.id_phieu_muon, pm.ngay_muon, pm.hen_tra, pm.trang_thai,
                     STRING_AGG(s.tieu_de, ', ') AS sach_list, pt.ngay_tra
              FROM phieu_muon pm
              JOIN ct_phieu_muon ctm ON ctm.id_phieu_muon=pm.id_phieu_muon
              JOIN sach s ON ctm.id_sach=s.id_sach
              LEFT JOIN phieu_tra pt ON pt.id_phieu_muon=pm.id_phieu_muon
              WHERE pm.id_doc_gia=@id
              GROUP BY pm.id_phieu_muon, pm.ngay_muon, pm.hen_tra, pm.trang_thai, pt.ngay_tra
              ORDER BY pm.ngay_muon DESC`);

    // Phạt
    const fines = await pool.request().input('id', sql.Int, id)
      .query(`SELECT id_phat, ly_do, so_tien, ngay_lap, trang_thai_thanh_toan
              FROM phat WHERE id_doc_gia=@id ORDER BY ngay_lap DESC`);

    // Tổng hợp
    const stats = await pool.request().input('id', sql.Int, id)
      .query(`SELECT
                (SELECT COUNT(*) FROM phieu_muon WHERE id_doc_gia=@id) AS tong_luot_muon,
                (SELECT COUNT(*) FROM phieu_muon WHERE id_doc_gia=@id AND trang_thai='overdue') AS so_qua_han,
                (SELECT ISNULL(SUM(so_tien),0) FROM phat WHERE id_doc_gia=@id) AS tong_tien_phat`);

    res.json({
      reader: info.recordset[0],
      borrows: borrows.recordset,
      fines: fines.recordset,
      stats: stats.recordset[0],
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

module.exports = { getReaders, getReaderById, createReader, updateReader, renewCard, toggleCard, deleteReader, getViolators, getReaderHistory };
