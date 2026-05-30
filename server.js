// server.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config();

const { connectDB } = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Tất cả API routes
app.use('/api', require('./routes/index'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// Trả về index.html nếu có (SPA), không thì báo API đang chạy
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'BIBLIOTHECA API đang chạy. Đặt file index.html vào thư mục public/ để dùng giao diện.' });
  }
});

connectDB();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✓ BIBLIOTHECA API chạy tại http://localhost:${PORT}`);
  console.log(`  Docs: xem README.md để biết danh sách endpoints\n`);
});
