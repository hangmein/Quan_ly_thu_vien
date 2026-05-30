// routes/bookRoutes.js
const express = require('express');
const router = express.Router();
const { getBooks, getBookById, createBook, updateBook, deleteBook } = require('../controllers/bookController');
const { xacThuc, phanQuyen } = require('../middleware/auth');

// Ai cũng xem được danh sách & chi tiết sách (không cần đăng nhập)
router.get('/', getBooks);
router.get('/:id', getBookById);

// Chỉ admin và thủ thư mới được thêm/sửa/xóa (phải đăng nhập + đúng vai trò)
router.post('/', xacThuc, phanQuyen('admin', 'librarian'), createBook);
router.put('/:id', xacThuc, phanQuyen('admin', 'librarian', 'reader'), updateBook);
router.delete('/:id', xacThuc, phanQuyen('admin'), deleteBook);

module.exports = router;
