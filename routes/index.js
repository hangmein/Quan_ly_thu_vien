// routes/index.js — Gom tất cả routes vào 1 chỗ
const express = require('express');
const { xacThuc, phanQuyen } = require('../middleware/auth');

// Controllers
const auth    = require('../controllers/authController');
const book    = require('../controllers/bookController');
const reader  = require('../controllers/readerController');
const staff   = require('../controllers/staffController');
const cat     = require('../controllers/catalogController');
const borrow  = require('../controllers/borrowController');
const fine    = require('../controllers/fineController');
const stats   = require('../controllers/statsController');
const history = require('../controllers/historyController');

const r = express.Router();

// ── AUTH ─────────────────────────────────────────────────────────
r.post('/auth/login', auth.login);

// ── MỤC 2: SÁCH ──────────────────────────────────────────────────
r.get   ('/books',     book.getBooks);
r.get   ('/books/:id', book.getBookById);
r.post  ('/books',     xacThuc, phanQuyen('admin','librarian'), book.createBook);
r.put   ('/books/:id', xacThuc, phanQuyen('admin','librarian'), book.updateBook);
r.delete('/books/:id', xacThuc, phanQuyen('admin'),             book.deleteBook);

// ── MỤC 3: ĐỘC GIẢ ───────────────────────────────────────────────
r.get  ('/readers',                xacThuc, reader.getReaders);
r.get  ('/readers/:id',            xacThuc, reader.getReaderById);
r.post ('/readers',                xacThuc, phanQuyen('admin','librarian'), reader.createReader);
r.put  ('/readers/:id',            xacThuc, phanQuyen('admin','librarian'), reader.updateReader);
r.patch('/readers/:id/gia-han',    xacThuc, phanQuyen('admin','librarian'), reader.renewCard);
r.patch('/readers/:id/khoa-the',   xacThuc, phanQuyen('admin','librarian'), reader.toggleCard);
r.delete('/readers/:id',           xacThuc, phanQuyen('admin'),             reader.deleteReader);
r.get  ('/readers/:id/lich-su',    xacThuc, reader.getReaderHistory);
r.get  ('/readers-vi-pham',        xacThuc, reader.getViolators);

// ── MỤC 4: NHÂN VIÊN ─────────────────────────────────────────────
r.get  ('/staff',              xacThuc, phanQuyen('admin'), staff.getStaff);
r.post ('/staff',              xacThuc, phanQuyen('admin'), staff.createStaff);
r.put  ('/staff/:id',          xacThuc, phanQuyen('admin'), staff.updateStaff);
r.patch('/staff/:id/nghi-viec',xacThuc, phanQuyen('admin'), staff.retire);

// ── MỤC 5: DANH MỤC ──────────────────────────────────────────────
r.get   ('/catalog/the-loai',       cat.theLoai.getAll);
r.post  ('/catalog/the-loai',       xacThuc, phanQuyen('admin'), cat.theLoai.create);
r.put   ('/catalog/the-loai/:id',   xacThuc, phanQuyen('admin'), cat.theLoai.update);
r.delete('/catalog/the-loai/:id',   xacThuc, phanQuyen('admin'), cat.theLoai.remove);

r.get   ('/catalog/tac-gia',        cat.tacGia.getAll);
r.post  ('/catalog/tac-gia',        xacThuc, phanQuyen('admin'), cat.tacGia.create);
r.put   ('/catalog/tac-gia/:id',    xacThuc, phanQuyen('admin'), cat.tacGia.update);
r.delete('/catalog/tac-gia/:id',    xacThuc, phanQuyen('admin'), cat.tacGia.remove);

r.get   ('/catalog/nxb',            cat.nxb.getAll);
r.post  ('/catalog/nxb',            xacThuc, phanQuyen('admin'), cat.nxb.create);
r.put   ('/catalog/nxb/:id',        xacThuc, phanQuyen('admin'), cat.nxb.update);
r.delete('/catalog/nxb/:id',        xacThuc, phanQuyen('admin'), cat.nxb.remove);

r.get   ('/catalog/ke-sach',        cat.keSach.getAll);
r.post  ('/catalog/ke-sach',        xacThuc, phanQuyen('admin'), cat.keSach.create);
r.put   ('/catalog/ke-sach/:id',    xacThuc, phanQuyen('admin'), cat.keSach.update);
r.delete('/catalog/ke-sach/:id',    xacThuc, phanQuyen('admin'), cat.keSach.remove);

r.get   ('/catalog/ngon-ngu',       cat.ngonNgu.getAll);
r.post  ('/catalog/ngon-ngu',       xacThuc, phanQuyen('admin'), cat.ngonNgu.create);
r.delete('/catalog/ngon-ngu/:id',   xacThuc, phanQuyen('admin'), cat.ngonNgu.remove);

r.get   ('/catalog/goi-the',        cat.getGoiThe);

// ── MỤC 6: NGHIỆP VỤ MƯỢN / TRẢ ─────────────────────────────────
r.get ('/borrows',                xacThuc, borrow.getBorrows);
r.post('/borrows',                xacThuc, phanQuyen('admin','librarian'), borrow.createBorrow);
r.post('/borrows/:id/tra',        xacThuc, phanQuyen('admin','librarian'), borrow.returnBorrow);
r.put ('/borrows/:id/gia-han',    xacThuc, phanQuyen('admin','librarian'), borrow.extendBorrow);
r.get ('/borrows/qua-han',        xacThuc, borrow.getOverdue);
r.get ('/borrows/sap-den-han',    xacThuc, borrow.getDueSoon);
r.get ('/borrows/dat-truoc',      xacThuc, borrow.getDatTruoc);
r.post('/borrows/dat-truoc',      xacThuc, borrow.createDatTruoc);

// ── MỤC 6: PHẠT & BÁO MẤT ───────────────────────────────────────
r.get  ('/fines',            xacThuc, fine.getFines);
r.get  ('/fines/bao-mat',    xacThuc, fine.getLostReports);
r.patch('/fines/:id/thu',    xacThuc, phanQuyen('admin','librarian'), fine.collectFine);
r.post ('/fines/bao-mat',    xacThuc, phanQuyen('admin','librarian'), fine.reportLost);

// ── MỤC 7: THỐNG KÊ ──────────────────────────────────────────────
r.get('/stats/tong-quan',        xacThuc, stats.tongQuan);
r.get('/stats/sach-muon-nhieu',  xacThuc, stats.sachMuonNhieu);
r.get('/stats/doc-gia-tich-cuc', xacThuc, stats.docGiaTichCuc);
r.get('/stats/theo-the-loai',    xacThuc, stats.muonTheoTheLoai);
r.get('/stats/ton-kho',          xacThuc, stats.tonKho);
r.get('/stats/muon-theo-ngay',   xacThuc, stats.muonTheoNgay);

// ── LỊCH SỬ LẬP PHIẾU (nhật ký nghiệp vụ) ───────────────────────
r.get('/history',                     xacThuc, history.getHistory);
r.get('/history/thong-ke-nhan-vien',  xacThuc, history.thongKeNhanVien);

module.exports = r;
