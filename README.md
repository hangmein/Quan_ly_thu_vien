# BIBLIOTHECA — Node.js + Express + SQL Server

## Cài đặt

```bash
cd bibliotheca-app
npm install
# Sửa file .env cho đúng thông tin SQL Server
npm run dev    # dev (nodemon)
npm start      # production
```

## Cấu trúc thư mục

```
bibliotheca-app/
├── config/
│   └── db.js                   # Kết nối SQL Server (connection pool)
├── controllers/
│   ├── authController.js       # Mục 1 — Đăng nhập, hash mật khẩu
│   ├── bookController.js       # Mục 2 — CRUD sách
│   ├── readerController.js     # Mục 3 — CRUD độc giả, gia hạn, khóa thẻ
│   ├── staffController.js      # Mục 4 — CRUD nhân viên
│   ├── catalogController.js    # Mục 5 — Danh mục (thể loại, tác giả, NXB...)
│   ├── borrowController.js     # Mục 6 — Mượn, trả, gia hạn, đặt trước (transaction)
│   ├── fineController.js       # Mục 6 — Thu phạt, báo mất sách
│   └── statsController.js      # Mục 7 — Thống kê, báo cáo (read-only)
├── middleware/
│   └── auth.js                 # Xác thực JWT + phân quyền vai trò
├── routes/
│   └── index.js                # Tất cả routes (gom 1 file cho dễ nhìn)
├── public/
│   └── index.html              # Đặt file HTML giao diện vào đây
├── .env
├── package.json
└── server.js
```

## Tạo mật khẩu hash

```bash
node -e "require('./controllers/authController').hashMK('matkhaucuaban')"
# Copy chuỗi hash vào cột mat_khau_hash trong bảng tai_khoan
```

## Danh sách API

### Đăng nhập
| Method | URL | Mô tả |
|--------|-----|--------|
| POST | /api/auth/login | Đăng nhập, nhận token JWT |

**Body:** `{ ten_dang_nhap, mat_khau }`
**Response:** `{ token, user: { id, ten_dang_nhap, vai_tro } }`

> Với các endpoint cần đăng nhập: thêm header `Authorization: Bearer <token>`

---

### Mục 2 — Sách
| Method | URL | Quyền | Mô tả |
|--------|-----|--------|--------|
| GET | /api/books | Công khai | DS sách (`?keyword=&the_loai=&page=&limit=`) |
| GET | /api/books/:id | Công khai | Chi tiết sách |
| POST | /api/books | admin, librarian | Thêm sách |
| PUT | /api/books/:id | admin, librarian | Sửa sách |
| DELETE | /api/books/:id | admin | Xóa sách |

---

### Mục 3 — Độc giả
| Method | URL | Quyền | Mô tả |
|--------|-----|--------|--------|
| GET | /api/readers | Đăng nhập | DS độc giả (`?keyword=&trang_thai=`) |
| GET | /api/readers/:id | Đăng nhập | Chi tiết |
| POST | /api/readers | admin, librarian | Đăng ký thẻ |
| PUT | /api/readers/:id | admin, librarian | Cập nhật |
| PATCH | /api/readers/:id/gia-han | admin, librarian | Gia hạn thẻ |
| PATCH | /api/readers/:id/khoa-the | admin, librarian | Khóa/mở thẻ |

---

### Mục 4 — Nhân viên
| Method | URL | Quyền | Mô tả |
|--------|-----|--------|--------|
| GET | /api/staff | admin | DS nhân viên |
| POST | /api/staff | admin | Thêm nhân viên + tạo tài khoản |
| PUT | /api/staff/:id | admin | Cập nhật |
| PATCH | /api/staff/:id/nghi-viec | admin | Nghỉ việc (khóa TK, giữ lịch sử) |

---

### Mục 5 — Danh mục
| Method | URL | Quyền | Mô tả |
|--------|-----|--------|--------|
| GET/POST/PUT/DELETE | /api/catalog/the-loai | admin | CRUD thể loại |
| GET/POST/PUT/DELETE | /api/catalog/tac-gia | admin | CRUD tác giả |
| GET/POST/PUT/DELETE | /api/catalog/nxb | admin | CRUD nhà xuất bản |
| GET/POST/PUT/DELETE | /api/catalog/ke-sach | admin | CRUD kệ sách |
| GET/POST/DELETE | /api/catalog/ngon-ngu | admin | Ngôn ngữ |
| GET | /api/catalog/goi-the | Đăng nhập | Danh sách gói thẻ |

---

### Mục 6 — Nghiệp vụ mượn / trả
| Method | URL | Quyền | Mô tả |
|--------|-----|--------|--------|
| GET | /api/borrows | Đăng nhập | DS phiếu mượn (`?trang_thai=&id_doc_gia=&keyword=`) |
| POST | /api/borrows | admin, librarian | Lập phiếu mượn (có transaction) |
| POST | /api/borrows/:id/tra | admin, librarian | Tiếp nhận trả (tự tạo phiếu phạt nếu trễ) |
| PUT | /api/borrows/:id/gia-han | admin, librarian | Gia hạn mượn |
| GET | /api/borrows/qua-han | Đăng nhập | DS sách quá hạn |
| GET | /api/borrows/dat-truoc | Đăng nhập | DS đặt trước |
| POST | /api/borrows/dat-truoc | Đăng nhập | Đặt trước sách |

**Body lập phiếu mượn:**
```json
{
  "id_doc_gia": 1,
  "id_nhan_vien": 1,
  "sach_ids": [2, 5],
  "hen_tra": "2026-06-30"
}
```

---

### Mục 6 — Phạt
| Method | URL | Quyền | Mô tả |
|--------|-----|--------|--------|
| GET | /api/fines | Đăng nhập | DS phiếu phạt (`?trang_thai=unpaid\|paid`) |
| PATCH | /api/fines/:id/thu | admin, librarian | Thu tiền phạt |
| POST | /api/fines/bao-mat | admin, librarian | Báo mất sách |

---

### Mục 7 — Thống kê
| Method | URL | Mô tả |
|--------|-----|--------|
| GET | /api/stats/tong-quan | Tổng quan dashboard |
| GET | /api/stats/sach-muon-nhieu?top=10 | Top sách mượn nhiều |
| GET | /api/stats/doc-gia-tich-cuc?top=10 | Top độc giả tích cực |
| GET | /api/stats/theo-the-loai | Lượt mượn theo thể loại |
| GET | /api/stats/ton-kho | Tồn kho theo thể loại |
| GET | /api/stats/muon-theo-ngay?ngay=7 | Biểu đồ 7 ngày |

---

## Lưu ý quan trọng

**Transaction:** `POST /api/borrows` và `POST /api/borrows/:id/tra` dùng SQL transaction — nếu bất kỳ bước nào lỗi, toàn bộ rollback. Đây là điểm quan trọng nhất của hệ thống.

**Phân quyền 3 cấp:**
- `reader` — chỉ xem, đặt trước
- `librarian` — thêm/sửa sách, lập phiếu mượn, thu phạt
- `admin` — toàn quyền, bao gồm xóa và quản lý nhân viên

**Thêm module mới:** Tạo `controllers/tenModule.js` → đăng ký route trong `routes/index.js`. Không cần sửa gì khác.
