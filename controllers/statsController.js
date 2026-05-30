// controllers/statsController.js — Mục 7: Thống kê & Báo cáo (read-only)
const { sql, getPool } = require('../config/db');

// GET /api/stats/tong-quan — Dashboard cards
async function tongQuan(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM sach)                                          AS tong_sach,
        (SELECT SUM(so_luong_ton) FROM sach)                                 AS ton_kho,
        (SELECT COUNT(*) FROM doc_gia WHERE trang_thai='active')             AS doc_gia_active,
        (SELECT COUNT(*) FROM phieu_muon WHERE trang_thai='borrowing')       AS dang_muon,
        (SELECT COUNT(*) FROM phieu_muon WHERE trang_thai='overdue')         AS qua_han,
        (SELECT ISNULL(SUM(so_tien),0) FROM phat
           WHERE trang_thai_thanh_toan='unpaid')                             AS tien_phat_chua_thu,
        (SELECT ISNULL(SUM(so_tien),0) FROM phat
           WHERE trang_thai_thanh_toan='paid'
             AND MONTH(ngay_lap)=MONTH(GETDATE())
             AND YEAR(ngay_lap)=YEAR(GETDATE()))                             AS doanh_thu_phat_thang
    `);
    res.json(r.recordset[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/stats/sach-muon-nhieu?top=10 — Tiến trình 7.1
async function sachMuonNhieu(req, res) {
  const top = parseInt(req.query.top) || 10;
  try {
    const pool = await getPool();
    const r = await pool.request().input('top', sql.Int, top).query(`
      SELECT TOP (@top)
             s.id_sach, s.tieu_de, tg.ho_ten AS tac_gia, tl.ten_the_loai,
             COUNT(ctm.id_sach) AS luot_muon,
             s.so_luong_ton, s.so_luong_tong
      FROM ct_phieu_muon ctm
      JOIN sach s ON ctm.id_sach=s.id_sach
      JOIN tac_gia tg ON s.id_tac_gia=tg.id_tac_gia
      JOIN the_loai tl ON s.id_the_loai=tl.id_the_loai
      GROUP BY s.id_sach,s.tieu_de,tg.ho_ten,tl.ten_the_loai,s.so_luong_ton,s.so_luong_tong
      ORDER BY luot_muon DESC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/stats/doc-gia-tich-cuc?top=10 — Tiến trình 7.2
async function docGiaTichCuc(req, res) {
  const top = parseInt(req.query.top) || 10;
  try {
    const pool = await getPool();
    const r = await pool.request().input('top', sql.Int, top).query(`
      SELECT TOP (@top)
             dg.id_doc_gia, dg.ho_ten, dg.email, gt.ten_goi,
             COUNT(pm.id_phieu_muon) AS tong_luot_muon
      FROM phieu_muon pm
      JOIN doc_gia dg ON pm.id_doc_gia=dg.id_doc_gia
      JOIN goi_the gt ON dg.id_goi_the=gt.id_goi_the
      GROUP BY dg.id_doc_gia,dg.ho_ten,dg.email,gt.ten_goi
      ORDER BY tong_luot_muon DESC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/stats/muon-theo-the-loai — Tiến trình 7.6
async function muonTheoTheLoai(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT tl.ten_the_loai, COUNT(ctm.id_sach) AS luot_muon
      FROM ct_phieu_muon ctm
      JOIN sach s ON ctm.id_sach=s.id_sach
      JOIN the_loai tl ON s.id_the_loai=tl.id_the_loai
      GROUP BY tl.ten_the_loai
      ORDER BY luot_muon DESC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/stats/ton-kho — Tiến trình 7.5
async function tonKho(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT tl.ten_the_loai,
             COUNT(s.id_sach)         AS so_dau_sach,
             SUM(s.so_luong_tong)     AS tong_ban,
             SUM(s.so_luong_ton)      AS ban_con
      FROM sach s JOIN the_loai tl ON s.id_the_loai=tl.id_the_loai
      GROUP BY tl.ten_the_loai
      ORDER BY tl.ten_the_loai
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/stats/muon-theo-ngay?ngay=7 — Biểu đồ 7 ngày gần nhất
async function muonTheoNgay(req, res) {
  const ngay = parseInt(req.query.ngay) || 7;
  try {
    const pool = await getPool();
    const r = await pool.request().input('n', sql.Int, ngay).query(`
      SELECT CAST(pm.ngay_muon AS DATE) AS ngay,
             COUNT(*) AS so_phieu
      FROM phieu_muon pm
      WHERE pm.ngay_muon >= DATEADD(DAY,-@n,GETDATE())
      GROUP BY CAST(pm.ngay_muon AS DATE)
      ORDER BY ngay
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

module.exports = { tongQuan, sachMuonNhieu, docGiaTichCuc, muonTheoTheLoai, tonKho, muonTheoNgay };
