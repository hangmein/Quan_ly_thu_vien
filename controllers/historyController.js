// controllers/historyController.js — Lịch sử lập phiếu (nhật ký nghiệp vụ)
// Truy vết: nhân viên nào lập phiếu gì, vào ngày nào
const { sql, getPool } = require('../config/db');

// GET /api/history?id_nhan_vien=&tu_ngay=&den_ngay=&loai=
// loai: 'muon' | 'tra' | '' (cả hai)
async function getHistory(req, res) {
  const { id_nhan_vien, tu_ngay, den_ngay, loai } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request();

    // Điều kiện lọc chung
    let whereM = "WHERE 1=1", whereT = "WHERE 1=1";
    if (id_nhan_vien) {
      whereM += ' AND pm.id_nhan_vien=@nv';
      whereT += ' AND pt.id_nhan_vien=@nv';
      r.input('nv', sql.Int, id_nhan_vien);
    }
    if (tu_ngay) {
      whereM += ' AND pm.ngay_muon >= @tu';
      whereT += ' AND pt.ngay_tra >= @tu';
      r.input('tu', sql.Date, tu_ngay);
    }
    if (den_ngay) {
      whereM += ' AND pm.ngay_muon <= @den';
      whereT += ' AND pt.ngay_tra <= @den';
      r.input('den', sql.Date, den_ngay);
    }

    // Phiếu mượn
    const phieuMuon = (loai === 'tra') ? '' : `
      SELECT
        'Mượn'                AS loai_phieu,
        pm.id_phieu_muon      AS ma_phieu,
        pm.ngay_muon          AS ngay,
        nv.id_nhan_vien,
        nv.ho_ten             AS nhan_vien,
        nv.chuc_vu,
        dg.ho_ten             AS doc_gia,
        STRING_AGG(s.tieu_de, ', ') AS chi_tiet,
        pm.trang_thai
      FROM phieu_muon pm
      JOIN nhan_vien nv ON pm.id_nhan_vien = nv.id_nhan_vien
      JOIN doc_gia   dg ON pm.id_doc_gia   = dg.id_doc_gia
      JOIN ct_phieu_muon ctm ON ctm.id_phieu_muon = pm.id_phieu_muon
      JOIN sach s ON ctm.id_sach = s.id_sach
      ${whereM}
      GROUP BY pm.id_phieu_muon, pm.ngay_muon, nv.id_nhan_vien, nv.ho_ten, nv.chuc_vu, dg.ho_ten, pm.trang_thai
    `;

    // Phiếu trả
    const phieuTra = (loai === 'muon') ? '' : `
      SELECT
        'Trả'                 AS loai_phieu,
        pt.id_phieu_tra       AS ma_phieu,
        pt.ngay_tra           AS ngay,
        nv.id_nhan_vien,
        nv.ho_ten             AS nhan_vien,
        nv.chuc_vu,
        dg.ho_ten             AS doc_gia,
        STRING_AGG(s.tieu_de, ', ') AS chi_tiet,
        N'Đã trả'             AS trang_thai
      FROM phieu_tra pt
      JOIN nhan_vien nv ON pt.id_nhan_vien = nv.id_nhan_vien
      JOIN phieu_muon pm ON pt.id_phieu_muon = pm.id_phieu_muon
      JOIN doc_gia   dg ON pm.id_doc_gia = dg.id_doc_gia
      JOIN ct_phieu_tra ctt ON ctt.id_phieu_tra = pt.id_phieu_tra
      JOIN sach s ON ctt.id_sach = s.id_sach
      ${whereT}
      GROUP BY pt.id_phieu_tra, pt.ngay_tra, nv.id_nhan_vien, nv.ho_ten, nv.chuc_vu, dg.ho_ten
    `;

    // Gộp 2 loại bằng UNION ALL (nếu cả hai cùng được chọn)
    let query;
    if (phieuMuon && phieuTra)      query = `${phieuMuon} UNION ALL ${phieuTra} ORDER BY ngay DESC, ma_phieu DESC`;
    else if (phieuMuon)             query = `${phieuMuon} ORDER BY ngay DESC, ma_phieu DESC`;
    else if (phieuTra)              query = `${phieuTra} ORDER BY ngay DESC, ma_phieu DESC`;
    else                            return res.json([]);

    const result = await r.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/history/thong-ke-nhan-vien?tu_ngay=&den_ngay=
// Thống kê: mỗi nhân viên lập bao nhiêu phiếu mượn / trả
async function thongKeNhanVien(req, res) {
  const { tu_ngay, den_ngay } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request();
    let condM = '', condT = '';
    if (tu_ngay)  { condM += ' AND pm.ngay_muon >= @tu'; condT += ' AND pt.ngay_tra >= @tu'; r.input('tu', sql.Date, tu_ngay); }
    if (den_ngay) { condM += ' AND pm.ngay_muon <= @den'; condT += ' AND pt.ngay_tra <= @den'; r.input('den', sql.Date, den_ngay); }

    const result = await r.query(`
      SELECT
        nv.id_nhan_vien,
        nv.ho_ten,
        nv.chuc_vu,
        (SELECT COUNT(*) FROM phieu_muon pm WHERE pm.id_nhan_vien = nv.id_nhan_vien ${condM}) AS so_phieu_muon,
        (SELECT COUNT(*) FROM phieu_tra  pt WHERE pt.id_nhan_vien = nv.id_nhan_vien ${condT}) AS so_phieu_tra
      FROM nhan_vien nv
      ORDER BY so_phieu_muon DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getHistory, thongKeNhanVien };
