// controllers/bookController.js — Mục 2: Quản lý sách
const { sql, getPool } = require('../config/db');

// GET /api/books?keyword=&the_loai=&page=&limit=
async function getBooks(req, res) {
  const { keyword, the_loai, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const pool = await getPool();
    const req2 = pool.request()
      .input('offset', sql.Int, offset)
      .input('limit',  sql.Int, parseInt(limit));

    let where = 'WHERE 1=1';
    if (keyword) { where += ' AND (s.tieu_de LIKE @kw OR tg.ho_ten LIKE @kw)'; req2.input('kw', sql.NVarChar, `%${keyword}%`); }
    if (the_loai) { where += ' AND tl.ten_the_loai = @tl'; req2.input('tl', sql.NVarChar, the_loai); }

    const result = await req2.query(`
      SELECT s.id_sach, s.isbn, s.tieu_de, s.nam_xuat_ban, s.anh_bia, 
             s.so_luong_ton, s.so_luong_tong, s.danh_gia, s.trang_thai,
             tl.ten_the_loai, tg.ho_ten AS tac_gia, nxb.ten_nxb, ke.ma_ke
      FROM sach s
      JOIN the_loai tl ON s.id_the_loai = tl.id_the_loai
      JOIN tac_gia  tg ON s.id_tac_gia  = tg.id_tac_gia
      LEFT JOIN nha_xuat_ban nxb ON s.id_nxb = nxb.id_nxb
      LEFT JOIN ke_sach      ke  ON s.id_ke  = ke.id_ke
      ${where}
      ORDER BY s.tieu_de
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// GET /api/books/:id
async function getBookById(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT s.*, tl.ten_the_loai, tg.ho_ten AS tac_gia,
               nxb.ten_nxb, ke.ma_ke, ke.vi_tri, ng.ten_ngon_ngu
        FROM sach s
        JOIN the_loai tl ON s.id_the_loai = tl.id_the_loai
        JOIN tac_gia  tg ON s.id_tac_gia  = tg.id_tac_gia
        LEFT JOIN nha_xuat_ban nxb ON s.id_nxb      = nxb.id_nxb
        LEFT JOIN ke_sach      ke  ON s.id_ke       = ke.id_ke
        LEFT JOIN ngon_ngu     ng  ON s.id_ngon_ngu = ng.id_ngon_ngu
        WHERE s.id_sach = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ message: 'Không tìm thấy sách' });
    res.json(result.recordset[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// POST /api/books
async function createBook(req, res) {
  const { isbn, tieu_de, id_the_loai, id_tac_gia, id_nxb, id_ke, id_ngon_ngu, nam_xuat_ban, so_luong_tong, anh_bia } = req.body;
  if (!tieu_de || !id_the_loai || !id_tac_gia)
    return res.status(400).json({ message: 'Thiếu tiêu đề, thể loại hoặc tác giả' });
  try {
    const pool = await getPool();
    const qty  = parseInt(so_luong_tong) || 1;
    const r = await pool.request()
      .input('isbn',        sql.NVarChar, isbn || null)
      .input('tieu_de',     sql.NVarChar, tieu_de)
      .input('id_the_loai', sql.Int,      id_the_loai)
      .input('id_tac_gia',  sql.Int,      id_tac_gia)
      .input('id_nxb',      sql.Int,      id_nxb      || null)
      .input('id_ke',       sql.Int,      id_ke        || null)
      .input('id_ngon_ngu', sql.Int,      id_ngon_ngu  || null)
      .input('nam',         sql.Int,      nam_xuat_ban || null)
      .input('qty',         sql.Int,      qty)
      .input('anh_bia',     sql.NVarChar, anh_bia || null)
      .query(`
        INSERT INTO sach (isbn,tieu_de,id_the_loai,id_tac_gia,id_nxb,id_ke,id_ngon_ngu,nam_xuat_ban,so_luong_tong,so_luong_ton,anh_bia)
        OUTPUT INSERTED.id_sach
        VALUES (@isbn,@tieu_de,@id_the_loai,@id_tac_gia,@id_nxb,@id_ke,@id_ngon_ngu,@nam,@qty,@qty,@anh_bia)
      `);
    res.status(201).json({ message: 'Thêm sách thành công', id_sach: r.recordset[0].id_sach });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// PUT /api/books/:id
async function updateBook(req, res) {
  const { tieu_de, id_the_loai, id_tac_gia, id_nxb, id_ke, nam_xuat_ban, so_luong_tong, anh_bia } = req.body;
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id',          sql.Int,      req.params.id)
      .input('tieu_de',     sql.NVarChar, tieu_de)
      .input('id_the_loai', sql.Int,      id_the_loai)
      .input('id_tac_gia',  sql.Int,      id_tac_gia)
      .input('id_nxb',      sql.Int,      id_nxb || null)
      .input('id_ke',       sql.Int,      id_ke  || null)
      .input('nam',         sql.Int,      nam_xuat_ban || null)
      .input('qty',         sql.Int,      so_luong_tong)
      .input('anh_bia',     sql.NVarChar, anh_bia || null)
      .query(`
        UPDATE sach
        SET tieu_de=@tieu_de, id_the_loai=@id_the_loai, id_tac_gia=@id_tac_gia,
            id_nxb=@id_nxb, id_ke=@id_ke, nam_xuat_ban=@nam, so_luong_tong=@qty, anh_bia=@anh_bia
        WHERE id_sach=@id
      `);
    if (!r.rowsAffected[0]) return res.status(404).json({ message: 'Không tìm thấy sách' });
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
}

// DELETE /api/books/:id
async function deleteBook(req, res) {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM sach WHERE id_sach=@id');
    if (!r.rowsAffected[0]) return res.status(404).json({ message: 'Không tìm thấy sách' });
    res.json({ message: 'Đã xóa sách' });
  } catch (err) {
    res.status(500).json({ message: 'Không thể xóa (sách đang được mượn hoặc có ràng buộc)', error: err.message });
  }
}

module.exports = { getBooks, getBookById, createBook, updateBook, deleteBook };