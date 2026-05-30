// controllers/fineController.js — Mục 6: Thu phạt & Báo mất
const { sql, getPool } = require('../config/db');

// GET /api/fines?trang_thai=
async function getFines(req, res) {
  const { trang_thai } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request();
    let where = 'WHERE 1=1';
    if (trang_thai) { where += ' AND p.trang_thai_thanh_toan=@tt'; r.input('tt', sql.NVarChar, trang_thai); }
    const result = await r.query(`
      SELECT p.*, dg.ho_ten AS doc_gia, dg.sdt
      FROM phat p JOIN doc_gia dg ON p.id_doc_gia=dg.id_doc_gia
      ${where} ORDER BY p.ngay_lap DESC
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// PATCH /api/fines/:id/thu — Tiến trình 6.6: Thu phạt
async function collectFine(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`UPDATE phat SET trang_thai_thanh_toan='paid' WHERE id_phat=@id AND trang_thai_thanh_toan='unpaid'`);
    if (!r.rowsAffected[0]) return res.status(400).json({ message: 'Phiếu phạt không tồn tại hoặc đã thanh toán' });
    res.json({ message: 'Thu tiền phạt thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// POST /api/fines/bao-mat — Tiến trình 6.7: Báo mất sách
// Body: { id_doc_gia, id_sach, tien_den_bu, id_phieu_muon? }
async function reportLost(req, res) {
  const { id_doc_gia, id_sach, tien_den_bu, id_phieu_muon } = req.body;
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const ngay = new Date().toISOString().split('T')[0];

    // Ghi vào bảng bao_mat
    const r1 = new sql.Request(transaction);
    const bm = await r1
      .input('sid', sql.Int,      id_sach)
      .input('dg',  sql.Int,      id_doc_gia)
      .input('nd',  sql.Date,     ngay)
      .input('tdb', sql.Decimal,  tien_den_bu || 0)
      .query(`INSERT INTO bao_mat (id_sach,id_doc_gia,ngay_bao,tien_den_bu)
              OUTPUT INSERTED.id_bao_mat VALUES (@sid,@dg,@nd,@tdb)`);

    // Giảm tổng số sách (sách mất = bị loại khỏi kho).
    // Đồng thời đảm bảo so_luong_ton không vượt quá so_luong_tong mới
    // (tránh vi phạm ràng buộc chk_ton: ton <= tong).
    const r2 = new sql.Request(transaction);
    await r2.input('sid2', sql.Int, id_sach)
      .query(`
        UPDATE sach
        SET so_luong_tong = so_luong_tong - 1,
            so_luong_ton  = CASE
                              WHEN so_luong_ton > so_luong_tong - 1
                              THEN so_luong_tong - 1
                              ELSE so_luong_ton
                            END
        WHERE id_sach = @sid2 AND so_luong_tong > 0
      `);

    // Xác định phiếu mượn: ưu tiên id truyền vào, nếu không thì tự tìm
    let idPM = id_phieu_muon || null;
    if (!idPM) {
      const r3 = new sql.Request(transaction);
      const pmChk = await r3.input('dg2', sql.Int, id_doc_gia).input('sid3', sql.Int, id_sach)
        .query(`SELECT TOP 1 pm.id_phieu_muon FROM phieu_muon pm
                JOIN ct_phieu_muon ctm ON ctm.id_phieu_muon=pm.id_phieu_muon
                WHERE pm.id_doc_gia=@dg2 AND ctm.id_sach=@sid3 AND pm.trang_thai IN ('borrowing','overdue')`);
      idPM = pmChk.recordset[0]?.id_phieu_muon || null;
    }

    if (idPM) {
      // Xóa cuốn bị mất khỏi chi tiết phiếu mượn (vì sẽ không bao giờ trả được)
      const r4 = new sql.Request(transaction);
      await r4.input('pm', sql.Int, idPM).input('sid4', sql.Int, id_sach)
        .query(`DELETE FROM ct_phieu_muon WHERE id_phieu_muon=@pm AND id_sach=@sid4`);

      // Kiểm tra phiếu mượn còn cuốn nào chưa? Nếu hết thì đóng phiếu
      const r5 = new sql.Request(transaction);
      const conLai = await r5.input('pm2', sql.Int, idPM)
        .query(`SELECT COUNT(*) AS cnt FROM ct_phieu_muon WHERE id_phieu_muon=@pm2`);

      if (conLai.recordset[0].cnt === 0) {
        // Phiếu không còn sách nào → đánh dấu đã xử lý xong
        const r6 = new sql.Request(transaction);
        await r6.input('pm3', sql.Int, idPM)
          .query(`UPDATE phieu_muon SET trang_thai='returned' WHERE id_phieu_muon=@pm3`);
      }
    }

    // Tạo phiếu phạt tiền đền bù
    if (tien_den_bu > 0) {
      const r7 = new sql.Request(transaction);
      await r7.input('pm4', sql.Int, idPM).input('dg3', sql.Int, id_doc_gia)
              .input('st', sql.Decimal, tien_den_bu).input('nl', sql.Date, ngay)
              .query(`INSERT INTO phat (id_phieu_muon,id_doc_gia,ly_do,so_tien,ngay_lap)
                      VALUES (@pm4,@dg3,N'Đền bù sách bị mất',@st,@nl)`);
    }

    await transaction.commit();
    res.status(201).json({ message: 'Đã ghi nhận báo mất sách', id: bm.recordset[0].id_bao_mat });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
}

// GET /api/fines/bao-mat — Danh sách sách bị báo mất
async function getLostReports(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT bm.id_bao_mat, bm.ngay_bao, bm.tien_den_bu, bm.trang_thai,
             s.tieu_de AS sach, s.id_sach,
             dg.ho_ten AS doc_gia, dg.sdt
      FROM bao_mat bm
      JOIN sach s    ON bm.id_sach    = s.id_sach
      JOIN doc_gia dg ON bm.id_doc_gia = dg.id_doc_gia
      ORDER BY bm.ngay_bao DESC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

module.exports = { getFines, collectFine, reportLost, getLostReports };
