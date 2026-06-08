// controllers/borrowController.js — Mục 6: Nghiệp vụ mượn / trả
// Đây là module phức tạp nhất — dùng transaction để đảm bảo toàn vẹn dữ liệu
const { sql, getPool } = require('../config/db');

// GET /api/borrows?trang_thai=&id_doc_gia=&keyword=
async function getBorrows(req, res) {
  const { trang_thai, id_doc_gia, keyword } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request();
    let where = 'WHERE 1=1';
    if (trang_thai)  { where += ' AND pm.trang_thai=@tt'; r.input('tt', sql.NVarChar, trang_thai); }
    if (id_doc_gia)  { where += ' AND pm.id_doc_gia=@dg'; r.input('dg', sql.Int, id_doc_gia); }
    if (keyword)     { where += ' AND (dg.ho_ten LIKE @kw OR s.tieu_de LIKE @kw)'; r.input('kw', sql.NVarChar, `%${keyword}%`); }
    const result = await r.query(`
      SELECT pm.id_phieu_muon, pm.ngay_muon, pm.hen_tra, pm.trang_thai,
             dg.ho_ten AS doc_gia, dg.id_doc_gia,
             nv.ho_ten AS nhan_vien,
             STRING_AGG(s.tieu_de, ', ') AS sach_list,
             pt.ngay_tra
      FROM phieu_muon pm
      JOIN doc_gia  dg ON pm.id_doc_gia   = dg.id_doc_gia
      JOIN nhan_vien nv ON pm.id_nhan_vien = nv.id_nhan_vien
      JOIN ct_phieu_muon ctm ON ctm.id_phieu_muon = pm.id_phieu_muon
      JOIN sach s ON ctm.id_sach = s.id_sach
      LEFT JOIN phieu_tra pt ON pt.id_phieu_muon = pm.id_phieu_muon
      ${where}
      GROUP BY pm.id_phieu_muon,pm.ngay_muon,pm.hen_tra,pm.trang_thai,
               dg.ho_ten,dg.id_doc_gia,nv.ho_ten,pt.ngay_tra
      ORDER BY pm.ngay_muon DESC
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// POST /api/borrows — Tiến trình 6.1: Lập phiếu mượn
// Body: { id_doc_gia, id_nhan_vien, sach_ids: [1,2], hen_tra }
async function createBorrow(req, res) {
  const { id_doc_gia, id_nhan_vien, sach_ids, hen_tra } = req.body;
  if (!id_doc_gia || !id_nhan_vien || !sach_ids?.length || !hen_tra)
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const req2 = new sql.Request(transaction);

    // Kiểm tra 1: Thẻ độc giả còn hạn và đang active
    const docGia = await req2.input('dg', sql.Int, id_doc_gia)
      .query(`SELECT dg.trang_thai, dg.ngay_het_han, gt.so_sach_toi_da
              FROM doc_gia dg JOIN goi_the gt ON dg.id_goi_the=gt.id_goi_the
              WHERE dg.id_doc_gia=@dg`);
    if (!docGia.recordset.length) throw new Error('Không tìm thấy độc giả');
    const { trang_thai, ngay_het_han, so_sach_toi_da } = docGia.recordset[0];
    if (trang_thai !== 'active')          throw new Error('Thẻ độc giả đã bị khóa');
    if (new Date(ngay_het_han) < new Date()) throw new Error('Thẻ độc giả đã hết hạn');

    // Kiểm tra 2: Số sách đang mượn chưa vượt giới hạn gói thẻ
    const r3 = new sql.Request(transaction);
    const dangMuon = await r3.input('dg2', sql.Int, id_doc_gia)
      .query(`SELECT COUNT(*) AS cnt FROM ct_phieu_muon ctm
              JOIN phieu_muon pm ON ctm.id_phieu_muon=pm.id_phieu_muon
              WHERE pm.id_doc_gia=@dg2 AND pm.trang_thai IN ('borrowing','overdue')`);
    const tongSauMuon = dangMuon.recordset[0].cnt + sach_ids.length;
    if (tongSauMuon > so_sach_toi_da)
      throw new Error(`Vượt giới hạn gói thẻ! Tối đa ${so_sach_toi_da} cuốn, đang mượn ${dangMuon.recordset[0].cnt}`);

    // Kiểm tra 3: Từng cuốn sách còn trong kho không
    for (const sachId of sach_ids) {
      const r4 = new sql.Request(transaction);
      const chk = await r4.input('sid', sql.Int, sachId)
        .query('SELECT so_luong_ton, tieu_de FROM sach WHERE id_sach=@sid');
      if (!chk.recordset.length)            throw new Error(`Sách ID ${sachId} không tồn tại`);
      if (chk.recordset[0].so_luong_ton < 1) throw new Error(`Sách "${chk.recordset[0].tieu_de}" đã hết`);
    }

    // Tạo phiếu mượn
    const r5 = new sql.Request(transaction);
    const pm = await r5
      .input('dg3', sql.Int,  id_doc_gia)
      .input('nv',  sql.Int,  id_nhan_vien)
      .input('nm',  sql.Date, new Date().toISOString().split('T')[0])
      .input('ht',  sql.Date, hen_tra)
      .query(`INSERT INTO phieu_muon (id_doc_gia,id_nhan_vien,ngay_muon,hen_tra)
              OUTPUT INSERTED.id_phieu_muon VALUES (@dg3,@nv,@nm,@ht)`);
    const idPM = pm.recordset[0].id_phieu_muon;

    // Thêm chi tiết + giảm tồn kho (atomic)
    for (const sachId of sach_ids) {
      const r6 = new sql.Request(transaction);
      await r6.input('pm',  sql.Int, idPM)
              .input('sid', sql.Int, sachId)
              .query(`INSERT INTO ct_phieu_muon (id_phieu_muon,id_sach,so_luong) VALUES (@pm,@sid,1);
                      UPDATE sach SET so_luong_ton=so_luong_ton-1 WHERE id_sach=@sid`);
    }

    await transaction.commit();
    res.status(201).json({ message: 'Lập phiếu mượn thành công', id_phieu_muon: idPM });
  } catch (err) {
    await transaction.rollback();
    res.status(400).json({ message: err.message });
  }
}

// POST /api/borrows/:id/tra — Tiến trình 6.2: Tiếp nhận trả
async function returnBorrow(req, res) {
  const idPM = parseInt(req.params.id);
  const { id_nhan_vien, tinh_trang_sach = 'Tốt' } = req.body;
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // Kiểm tra phiếu mượn
    const r1 = new sql.Request(transaction);
    const pm = await r1.input('id', sql.Int, idPM)
      .query('SELECT * FROM phieu_muon WHERE id_phieu_muon=@id');
    if (!pm.recordset.length) throw new Error('Không tìm thấy phiếu mượn');
    if (pm.recordset[0].trang_thai === 'returned') throw new Error('Phiếu này đã được trả rồi');

    const ngayTra = new Date().toISOString().split('T')[0];
    const ngayHT  = new Date(pm.recordset[0].hen_tra);
    const treTre  = Math.max(0, Math.ceil((new Date(ngayTra)-ngayHT) / 86400000));

    // Tạo phiếu trả
    const r2 = new sql.Request(transaction);
    const pt = await r2
      .input('pm',  sql.Int,      idPM)
      .input('nv',  sql.Int,      id_nhan_vien)
      .input('nt',  sql.Date,     ngayTra)
      .input('ttS', sql.NVarChar, tinh_trang_sach)
      .query(`INSERT INTO phieu_tra (id_phieu_muon,id_nhan_vien,ngay_tra,tinh_trang_sach)
              OUTPUT INSERTED.id_phieu_tra VALUES (@pm,@nv,@nt,@ttS)`);
    const idPT = pt.recordset[0].id_phieu_tra;

    // Lấy danh sách sách cần trả
    const r3 = new sql.Request(transaction);
    const sachList = await r3.input('pm2', sql.Int, idPM)
      .query('SELECT id_sach FROM ct_phieu_muon WHERE id_phieu_muon=@pm2');

    for (const row of sachList.recordset) {
      const r4 = new sql.Request(transaction);
      await r4.input('pt2', sql.Int, idPT)
              .input('sid', sql.Int, row.id_sach)
              .query(`INSERT INTO ct_phieu_tra (id_phieu_tra,id_sach,so_luong,ghi_chu) VALUES (@pt2,@sid,1,NULL);
                      UPDATE sach SET so_luong_ton=so_luong_ton+1 WHERE id_sach=@sid`);
    }

    // Cập nhật trạng thái phiếu mượn
    const r5 = new sql.Request(transaction);
    await r5.input('id', sql.Int, idPM).query(`UPDATE phieu_muon SET trang_thai='returned' WHERE id_phieu_muon=@id`);

    // Tạo phiếu phạt nếu trả trễ (10,000 VNĐ/ngày)
    let phieuPhat = null;
    if (treTre > 0) {
      const soTien = treTre * 10000;
      const r6 = new sql.Request(transaction);
      phieuPhat = await r6
        .input('pm3', sql.Int,      idPM)
        .input('dg',  sql.Int,      pm.recordset[0].id_doc_gia)
        .input('ly',  sql.NVarChar, `Trả trễ ${treTre} ngày`)
        .input('st',  sql.Decimal,  soTien)
        .input('nl',  sql.Date,     ngayTra)
        .query(`INSERT INTO phat (id_phieu_muon,id_doc_gia,ly_do,so_tien,ngay_lap)
                OUTPUT INSERTED.id_phat VALUES (@pm3,@dg,@ly,@st,@nl)`);
    }

    await transaction.commit();
    res.json({
      message: treTre > 0 ? `Tiếp nhận trả. Trễ ${treTre} ngày — phiếu phạt đã được tạo` : 'Tiếp nhận trả thành công',
      id_phieu_tra: idPT,
      tre_han: treTre,
      phat: phieuPhat?.recordset[0]?.id_phat || null
    });
  } catch (err) {
    await transaction.rollback();
    res.status(400).json({ message: err.message });
  }
}

// PUT /api/borrows/:id/gia-han — Tiến trình 6.4: Gia hạn
async function extendBorrow(req, res) {
  const { so_ngay = 7 } = req.body;
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id',    sql.Int, req.params.id)
      .input('ngay',  sql.Int, parseInt(so_ngay))
      .query(`UPDATE phieu_muon SET hen_tra=DATEADD(DAY,@ngay,hen_tra)
              WHERE id_phieu_muon=@id AND trang_thai='borrowing'`);
    if (!r.rowsAffected[0]) return res.status(400).json({ message: 'Không thể gia hạn' });
    res.json({ message: `Đã gia hạn thêm ${so_ngay} ngày` });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/borrows/qua-han — Tiến trình 6.5: Danh sách quá hạn
async function getOverdue(req, res) {
  try {
    const pool = await getPool();
    const today = new Date().toISOString().split('T')[0];
    const r = await pool.request().input('today', sql.Date, today).query(`
      SELECT pm.id_phieu_muon, pm.hen_tra,
             DATEDIFF(DAY,pm.hen_tra,GETDATE()) AS so_ngay_tre,
             dg.ho_ten AS doc_gia, dg.sdt, dg.email,
             STRING_AGG(s.tieu_de,', ') AS sach_list
      FROM phieu_muon pm
      JOIN doc_gia dg ON pm.id_doc_gia=dg.id_doc_gia
      JOIN ct_phieu_muon ctm ON ctm.id_phieu_muon=pm.id_phieu_muon
      JOIN sach s ON ctm.id_sach=s.id_sach
      WHERE pm.trang_thai='borrowing' AND pm.hen_tra < @today
      GROUP BY pm.id_phieu_muon,pm.hen_tra,dg.ho_ten,dg.sdt,dg.email
      ORDER BY so_ngay_tre DESC
    `);
    // Cập nhật trạng thái thành overdue
    await pool.request().input('today2', sql.Date, today)
      .query(`UPDATE phieu_muon SET trang_thai='overdue' WHERE trang_thai='borrowing' AND hen_tra<@today2`);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/borrows/dat-truoc — Tiến trình 6.3: Danh sách đặt trước
async function getDatTruoc(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT dt.*, dg.ho_ten AS doc_gia, s.tieu_de AS sach, s.so_luong_ton
      FROM dat_truoc dt
      JOIN doc_gia dg ON dt.id_doc_gia=dg.id_doc_gia
      JOIN sach s ON dt.id_sach=s.id_sach
      WHERE dt.trang_thai='waiting'
      ORDER BY dt.ngay_dat
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// POST /api/borrows/dat-truoc
async function createDatTruoc(req, res) {
  const { id_doc_gia, id_sach } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('dg',  sql.Int,  id_doc_gia)
      .input('sid', sql.Int,  id_sach)
      .input('nd',  sql.Date, new Date().toISOString().split('T')[0])
      .query(`INSERT INTO dat_truoc (id_doc_gia,id_sach,ngay_dat) VALUES (@dg,@sid,@nd)`);
    res.status(201).json({ message: 'Đặt trước thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/borrows/sap-den-han?ngay=3 — Sách sắp đến hạn trả (trong N ngày tới)
async function getDueSoon(req, res) {
  const ngay = parseInt(req.query.ngay) || 3;
  try {
    const pool = await getPool();
    const r = await pool.request().input('n', sql.Int, ngay).query(`
      SELECT pm.id_phieu_muon, pm.ngay_muon, pm.hen_tra,
             DATEDIFF(DAY, GETDATE(), pm.hen_tra) AS con_lai,
             dg.ho_ten AS doc_gia, dg.sdt, dg.email,
             STRING_AGG(s.tieu_de, ', ') AS sach_list
      FROM phieu_muon pm
      JOIN doc_gia dg ON pm.id_doc_gia = dg.id_doc_gia
      JOIN ct_phieu_muon ctm ON ctm.id_phieu_muon = pm.id_phieu_muon
      JOIN sach s ON ctm.id_sach = s.id_sach
      WHERE pm.trang_thai = 'borrowing'
        AND pm.hen_tra >= CAST(GETDATE() AS DATE)
        AND pm.hen_tra <= DATEADD(DAY, @n, CAST(GETDATE() AS DATE))
      GROUP BY pm.id_phieu_muon, pm.ngay_muon, pm.hen_tra, dg.ho_ten, dg.sdt, dg.email
      ORDER BY pm.hen_tra
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

module.exports = { getBorrows, createBorrow, returnBorrow, extendBorrow, getOverdue, getDatTruoc, createDatTruoc, getDueSoon };
