// middleware/auth.js
const jwt = require('jsonwebtoken');

// Kiểm tra token hợp lệ
function xacThuc(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Chưa đăng nhập (thiếu token)' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token không hợp lệ hoặc hết hạn' });
    req.user = decoded;
    next();
  });
}

// Kiểm tra vai trò — dùng: phanQuyen('admin', 'librarian')
function phanQuyen(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.vai_tro)) {
      return res.status(403).json({ message: 'Không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

module.exports = { xacThuc, phanQuyen };
