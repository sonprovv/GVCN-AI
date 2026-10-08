# PLAN — GVCN 360 dùng Botkeep Cloud + PostgreSQL/JSONB

## 1. Mục tiêu

- Một URL HTTPS cho mọi thiết bị. FE **không** lưu dữ liệu học sinh trong localStorage.
- Backend Node.js giữ quy tắc nghiệp vụ và xử lý các REST API.
- Dữ liệu được lưu ở một PostgreSQL server riêng. Chia sẻ link hoặc cập nhật mã FE/BE không làm reset bảng dữ liệu.
- Bảo vệ API dữ liệu bằng đăng nhập mật khẩu. Mức này dành cho MVP nhóm giáo viên nhỏ; chưa phải hệ thống phân quyền theo từng tài khoản.
- Chạy local không cần database, sử dụng JSON file để thử chức năng.

## 2. Sơ đồ

```
Trình duyệt A / B / C
    | HTTPS + session cookie
    v
Botkeep Domains (HTTPS) -> Node.js / SERVER_PORT / HOST=0.0.0.0
                           |-- GET / -> frontend/index.html + assets + modules
                           |-- /api/auth/* -> đăng nhập, cookie HttpOnly
                           |-- /api/* -> route -> service -> storage adapter
                                                      | DATABASE_URL tồn tại
                                                      v
                                            PostgreSQL (JSONB, botkeep database)
                                                      |
                                            gvcn_documents(name,payload)

Local dev khi DATABASE_URL không tồn tại: backend/storage/jsonStore.js -> backend/data/*.json
```

## 3. Vì sao chọn PostgreSQL JSONB?

- Lưu đúng cấu trúc JSON cũ, không cần chuyển ngay toàn bộ dữ liệu thành bảng quan hệ.
- Có độ bền database và có thể sao lưu, phục hồi độc lập với việc deploy Node.js.
- Transaction + khóa `SELECT ... FOR UPDATE` giúp mỗi cập nhật trên cùng collection không ghi đè nhau.
- **Trade-off**: mỗi loại dữ liệu được lưu cả một document; ổn cho lớp nhỏ, không tối ưu khi có rất nhiều trường/học sinh. Giai đoạn lớn nên tách bảng students, attendance_records, classes, users với ràng buộc khóa ngoại.

### Schema SQL (backend sẽ tự tạo)

```sql
CREATE TABLE IF NOT EXISTS gvcn_documents (
  name TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Các khóa `name`: `classes`, `students`, `attendance`, `subjects`, `tasks`, `templates`, `reports`, `messages`.

### Payload mẫu

```json
{"name":"students","payload":[{"id":"HS12A5-01","classId":"12A5","name":"Học sinh minh hoạ","gender":"Nam","averageScore":7.5,"attendanceRate":98,"status":"Ổn định"}]}
```

```json
{"name":"attendance","payload":{"sessions":[{"date":"2026-10-08","classId":"12A5","records":[{"studentId":"HS12A5-01","status":"present"}]}]}}
```

*Lưu ý*: trên PostgreSQL, mỗi đối tượng ví dụ ở trên là một hàng gồm 2 trường `name` và `payload` chứ không phải toàn bộ dữ liệu bị gửi ra browser như một object wrapper.

## 4. Hành vi cập nhật dữ liệu

Khi A điểm danh và bấm Lưu:

1. Browser gửi `PUT /api/attendance/2026-10-08` kèm JSON.
2. Node.js xác thực cookie, kiểm tra Origin, định dạng, mã học sinh, số bản ghi và trạng thái.
3. Storage adapter bắt đầu transaction PostgreSQL.
4. `SELECT payload FROM gvcn_documents WHERE name='attendance' FOR UPDATE` khóa hàng dữ liệu.
5. Sửa session theo lớp + ngày rồi `UPDATE ... SET payload=$2::jsonb`.
6. `COMMIT`, API trả `200`. B mở cùng URL và tải trang sẽ nhận bản cập nhật mới.

Giao diện không push realtime giữa các tab: B cần refresh hoặc truy cập lại dữ liệu. Bản này chưa có WebSocket hoặc cơ chế thông báo thay đổi tức thời.

## 5. Môi trường

Local `npm start` không đặt `DATABASE_URL`: JSON file trong `backend/data`; muốn chọn đường dẫn khác, đặt `GVCN_DATA_DIR`.

Cloud `NODE_ENV=production`: bắt buộc có `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`. Không fallback xuống JSON local để tránh deploy chạy bình thường nhưng mất dữ liệu sau khi triển khai lại.

Các biến: `DATABASE_URL`, `PGSSL_MODE`, `PGSSL_CA_PEM` (tùy Botkeep), `SEED_DEMO_DATA`, `APP_PASSWORD`, `SESSION_SECRET`, `NODE_ENV`, `HOST`, `SERVER_PORT`, `PUBLIC_ORIGIN`.

## 6. API

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/health` | Kiểm tra DB trả về `ok` |
| GET | `/api/auth/status` | Trạng thái đăng nhập |
| POST | `/api/auth/login` | Nhận mật khẩu, tạo cookie 12 giờ |
| POST | `/api/auth/logout` | Xóa cookie phía trình duyệt |
| GET | `/api/classes` | Danh sách lớp |
| GET | `/api/dashboard?classId=12A5` | Tổng quan |
| GET/POST | `/api/students` | Danh sách, thêm học sinh |
| PATCH/DELETE | `/api/students/:id` | Sửa/xóa học sinh |
| GET | `/api/attendance?classId=12A5&date=YYYY-MM-DD` | Lấy điểm danh |
| PUT | `/api/attendance/:date` | Lưu điểm danh |
| GET | `/api/subjects`, `/api/templates`, `/api/messages`, `/api/reports` | Đọc dữ liệu nghiệp vụ |
| GET/PATCH | `/api/tasks` và `/api/tasks/:id` | Danh sách/sửa trạng thái việc |
| POST | `/api/assistant/chat` | Trả lời mẫu, KHÔNG phải AI thật |

Các API dữ liệu đều yêu cầu session (trừ `/api/health`, `/api/auth/*`).

## 7. Backup & giới hạn

- Dùng backup/restore database của Botkeep và lưu bản backup riêng ngoài nhà cung cấp. Theo hướng dẫn Botkeep, hãy dừng database trước khi backup bằng file snapshot trong panel.
- Có `npm run export-json` để xuất 8 JSON collection từ database ra thư mục `backups/`; sau đó **tải file khỏi cloud ngay**. Thư mục này không thay thế backup database có transaction log.
- Không gửi `DATABASE_URL`, mật khẩu, chứng chỉ khóa riêng hay file dữ liệu học sinh có thông tin thật qua chat hoặc GitHub công khai.
- Cơ chế này mới có một mật khẩu nhóm, chưa có phân quyền giáo viên / phụ huynh, audit log, reset mật khẩu, mã hóa từng dữ liệu ở cấp ứng dụng, hay phân quyền theo lớp. Không đưa dữ liệu học sinh thật lên môi trường công khai trước khi rà soát bảo mật và pháp lý.
- Nếu mất cả database và bản sao lưu thì không thể bảo đảm khôi phục. Tính bền vững không đồng nghĩa 100% không bao giờ mất dữ liệu.
