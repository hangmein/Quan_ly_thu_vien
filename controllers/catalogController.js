// controllers/catalogController.js — Mục 5: Quản lý danh mục
const { sql, getPool } = require('../config/db');

// Helper CRUD chung cho các bảng danh mục
function crudFor(table, pkCol, cols) {
  return {
    async getAll(req, res) {
      try {
        const pool = await getPool();
        const r = await pool.request().query(`SELECT * FROM ${table} ORDER BY ${cols[0]}`);
        res.json(r.recordset);
      } catch (err) { res.status(500).json({ message: err.message }); }
    },
    async create(req, res) {
      try {
        const pool = await getPool();
        const req2 = pool.request();
        const colList = cols.join(',');
        const paramList = cols.map(c => '@'+c).join(',');
        cols.forEach(c => req2.input(c, sql.NVarChar, req.body[c] || null));
        const r = await req2.query(`INSERT INTO ${table} (${colList}) OUTPUT INSERTED.${pkCol} VALUES (${paramList})`);
        res.status(201).json({ id: r.recordset[0][pkCol], message: 'Thêm thành công' });
      } catch (err) { res.status(500).json({ message: err.message }); }
    },
    async update(req, res) {
      try {
        const pool = await getPool();
        const req2 = pool.request().input('id', sql.Int, req.params.id);
        const setList = cols.map(c => { req2.input(c, sql.NVarChar, req.body[c]||null); return `${c}=@${c}`; }).join(',');
        await req2.query(`UPDATE ${table} SET ${setList} WHERE ${pkCol}=@id`);
        res.json({ message: 'Cập nhật thành công' });
      } catch (err) { res.status(500).json({ message: err.message }); }
    },
    async remove(req, res) {
      try {
        const pool = await getPool();
        const r = await pool.request()
          .input('id', sql.Int, req.params.id)
          .query(`DELETE FROM ${table} WHERE ${pkCol}=@id`);
        if (!r.rowsAffected[0]) return res.status(404).json({ message: 'Không tìm thấy' });
        res.json({ message: 'Đã xóa' });
      } catch (err) { res.status(500).json({ message: 'Không thể xóa (có ràng buộc)', error: err.message }); }
    }
  };
}

// 5.1 Thể loại
const theLoai     = crudFor('the_loai',     'id_the_loai', ['ten_the_loai','mo_ta']);
// 5.2 Tác giả
const tacGia      = crudFor('tac_gia',      'id_tac_gia',  ['ho_ten','quoc_tich']);
// 5.3 Nhà xuất bản
const nxb         = crudFor('nha_xuat_ban', 'id_nxb',      ['ten_nxb','dia_chi']);
// 5.4 Kệ sách
const keSach      = crudFor('ke_sach',      'id_ke',       ['ma_ke','vi_tri']);
// 5.5 Ngôn ngữ
const ngonNgu     = crudFor('ngon_ngu',     'id_ngon_ngu', ['ten_ngon_ngu']);
// 5.6 Gói thẻ (chỉ đọc, sửa thủ công)
async function getGoiThe(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT * FROM goi_the ORDER BY phi_thang');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

module.exports = { theLoai, tacGia, nxb, keSach, ngonNgu, getGoiThe };
