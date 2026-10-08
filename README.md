# GVCN 360 — Botkeep Cloud + PostgreSQL JSONB

Bản nâng cấp từ GVCN 360 FE/BE, đã nối mã nguồn vào bộ lưu trữ PostgreSQL JSONB chạy trên mạng (khi có `DATABASE_URL`). Không cần Supabase; có thể đặt Node.js và PostgreSQL trên cùng tài khoản Botkeep.

## Chạy thử trên máy tính

Yêu cầu Node.js >=18 (khuyên Node.js 22).

```bash
npm install
npm test
npm start
```

Truy cập `http://127.0.0.1:3000`. Không khai báo `DATABASE_URL`: API lưu file trong `backend/data/*.json` (chỉ dành cho local). Sẽ không có yêu cầu đăng nhập nếu chưa đặt `APP_PASSWORD`/`SESSION_SECRET` ở local.

## Deploy lên Botkeep

**Đọc `HUONG_DAN_BOTKEEP.md`** theo đúng thứ tự: tạo database, chuẩn bị secrets, tạo Node.js app, upload ZIP hoặc GitHub, cấu hình Network + Domains, thử ghi dữ liệu từ hai máy, backup.

**Bắt buộc trên cloud**:

- `NODE_ENV=production`, `HOST=0.0.0.0`
- `DATABASE_URL=postgresql://...` trỏ tới database PostgreSQL thật
- `APP_PASSWORD` có ít nhất 12 ký tự và `SESSION_SECRET` có ít nhất 32 ký tự ngẫu nhiên
- `PGSSL_MODE=verify-full` nếu Botkeep DB hỗ trợ TLS với chứng chỉ phù hợp; sử dụng `PGSSL_CA_PEM` nếu cần CA riêng
- `SERVER_PORT` là cổng được Botkeep Network cấp. Không gán cổng tùy tiện.

Với cấu hình production mà thiếu DB/mật khẩu, server **cố ý từ chối khởi động** thay vì âm thầm lưu vào JSON dễ mất.

### Dữ liệu lúc khởi tạo

Database mới tự tạo bảng `gvcn_documents` và 8 collection. `classes` nạp lớp minh họa; các collection khác rỗng nếu `SEED_DEMO_DATA=false` (mặc định). Để đưa dữ liệu demo cũ từ `backend/data/*.json` lên PostgreSQL **vào lần khởi tạo đầu tiên**, chọn `SEED_DEMO_DATA=true`. Lần khởi động/deploy tiếp theo sẽ KHÔNG ghi đè dữ liệu hiện có (INSERT ON CONFLICT DO NOTHING).

### Cấu trúc

```text
frontend/  -> giao diện HTML/CSS/JS, sử dụng REST API
backend/routes/ -> API + auth
backend/services/ -> logic thống kê / điểm danh
backend/storage/index.js -> chọn JSON local hoặc PostgreSQL
backend/storage/postgresStore.js -> PostgreSQL JSONB, transaction, seed-once
backend/storage/jsonStore.js -> local JSON files
backend/data/*.json -> data mẫu/local (không nên chứa dữ liệu thật trong ZIP)
backend/auth.js -> mật khẩu, cookie HttpOnly, timeout
scripts/export-json.js -> xuất bản sao JSON từ DB
.env.example -> tên biến môi trường (GIÁ TRỊ GIẢ)
tests/ -> tự kiểm tra JSON API, auth, mock adapter PostgreSQL
HUONG_DAN_BOTKEEP.md -> hướng dẫn triển khai chi tiết
PLAN_KIEN_TRUC.md -> kiến trúc, schema, API, luồng ghi data
```

### Hỗ trợ

- Trợ lý AI hiện chỉ trả lời mô phỏng, không gọi LLM ngoài.
- Bản code có thể deploy; **chưa thể xác nhận website live** khi chưa có quyền truy cập tài khoản Botkeep/database của bạn.
- Chưa kiểm thử trực tiếp kết nối PostgreSQL Botkeep vì không có credentials trong môi trường này. Bộ test mock adapter xác nhận luồng truy vấn/transaction, không thay thế kiểm thử thực tế sau triển khai.
