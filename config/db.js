const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, 
    database: process.env.DB_NAME,
    options: {
        encrypt: false, 
        trustServerCertificate: true 
    }
};

// Khởi tạo một biến lưu trữ Pool
let poolPromise;

async function connectDB() {
    try {
        // Tạo hồ chứa kết nối thay vì kết nối đơn lẻ
        poolPromise = new sql.ConnectionPool(config).connect();
        await poolPromise;
        console.log(`✓ Đã kết nối thành công tới SQL Server [${process.env.DB_SERVER}]!`);
    } catch (err) {
        console.log('\n================ BÁO CÁO LỖI KẾT NỐI ================');
        console.error(err.message);
        console.log('=====================================================\n');
    }
}

// Hàm getPool để xuất ra cho bookController dùng
const getPool = async () => {
    if (!poolPromise) throw new Error("Database chưa được kết nối!");
    return await poolPromise;
};

// Xuất khẩu đủ 3 món
module.exports = { sql, connectDB, getPool };