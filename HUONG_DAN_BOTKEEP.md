# HƯỚNG DẪN TRIỂN KHAI GVCN 360 TRÊN BOTKEEP

Các bước được đối chiếu với tài liệu công khai của Botkeep ngày 08/10/2026. Tên nút trong giao diện đăng nhập có thể thay đổi.

Link chính thức:
- Panel: https://botkeep.cloud/app
- Hosting apps/databases/network/domain: https://botkeep.cloud/docs/hosting
- Upload ZIP: https://botkeep.cloud/docs/zip
- Database & TLS: https://botkeep.cloud/hosting/databases
- Deploy từ GitHub: https://botkeep.cloud/docs/github

## Phần A: Tạo PostgreSQL dùng chung

1. Đăng nhập https://botkeep.cloud/app, vào phần tạo server/workload mới.
2. Chọn **Database → PostgreSQL** (không chọn Redis vì Redis không phù hợp làm nguồn dữ liệu học sinh chính). Chọn tài nguyên RAM/CPU/storage đủ cho database, trong hạn mức gói Botkeep.
3. Chờ database có trạng thái đang chạy. Mở tab **Database** của workload mới, tìm: host, port, database name, user, password, cấu hình TLS và CA nếu có.
4. Tạo connection URI theo thông tin thật **của chính bạn**:
   `postgresql://<user>:<password-da-URL-encode>@<host>:<port>/<database>`
   Ví dụ minh họa KHÔNG phải URL thật: `postgresql://gvcn_user:replace_me@pg.private.example:5432/gvcn360`.
5. Nếu Botkeep cấp địa chỉ kết nối private/internal dành cho ứng dụng trên cùng nền tảng, ưu tiên địa chỉ đó. Không tự đoán host nội bộ hay mở cổng database công khai nếu không cần.
6. Xem Botkeep hướng dẫn TLS: `PGSSL_MODE=verify-full` là mặc định trong source và xác thực chứng chỉ. Khi có CA certificate riêng, thêm PEM vào biến `PGSSL_CA_PEM`, xuống dòng ghi dạng `\n`. `PGSSL_MODE=disable` chỉ dùng khi bạn biết chắc kết nối private không hỗ trợ TLS và chấp nhận rủi ro; không dùng trên Internet công khai.

**Rất quan trọng**: Không gửi mật khẩu DB, `DATABASE_URL`, session secret cho bất cứ ai hoặc dán vào chat. Chỉ điền trong **Environment/Secrets** của Botkeep.

## Phần B: Tạo server Node.js và upload source

1. Tải ZIP `gvcn360-botkeep-deploy.zip` (được cung cấp cùng câu trả lời), giải nén để kiểm tra `package.json` ở **ngay cấp gốc của ZIP**. ZIP đã được đóng đúng cấu trúc này.
2. Botkeep → tạo Workload → **Node.js** → chọn source **ZIP** → tải file ZIP đó; có thể dùng GitHub thay ZIP nếu muốn tự động theo dõi revision.
3. Chọn Node.js 22 nếu có, phù hợp với `package.json`.
4. Cài dependencies: chạy `npm install` trong dự án khi nền tảng yêu cầu. Nếu có bước Build/Install, sử dụng `npm install`; lệnh khởi động **`npm start`** (hoặc `node backend/server.js`). Package `pg` sẽ được tải từ npm registry của Botkeep khi build có mạng.
5. Trong mục **Environment**, thêm các biến sau (chỉ placeholder ở tài liệu này):

| Biến | Giá trị trên Botkeep | Bắt buộc |
|---|---|---|
| `NODE_ENV` | `production` | Có |
| `HOST` | `0.0.0.0` | Có |
| `DATABASE_URL` | URI PostgreSQL thật từ bước A | Có |
| `PGSSL_MODE` | `verify-full` (mặc định) | Khuyên dùng |
| `PGSSL_CA_PEM` | CA PEM nếu Botkeep yêu cầu | Tùy TLS |
| `APP_PASSWORD` | mật khẩu nhóm bí mật, ít nhất 12 ký tự, đủ khó đoán | Có |
| `SESSION_SECRET` | chuỗi ngẫu nhiên ít nhất 32 ký tự | Có |
| `SEED_DEMO_DATA` | `false` cho DB mới, `true` để import demo ở lần đầu | Tùy |
| `PUBLIC_ORIGIN` | URL HTTPS cuối cùng của website (ví dụ `https://gvcn.example.edu.vn`) | Khuyên dùng sau khi có domain |
| `SERVER_PORT` | cổng do Botkeep **Network** gán (nếu chưa được inject tự động) | Có giá trị từ panel |

Tạo SESSION_SECRET trên máy bạn bằng lệnh:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

6. Trong **Network**, xác định cổng HTTP được gán. Backend ưu tiên `SERVER_PORT`, sau đó `PORT`, rồi local mặc định `3000`; host trên cloud là `0.0.0.0`.
7. Mở **Domains**, bật HTTPS routing cho workload Node.js và gắn subdomain của Botkeep hoặc xác minh DNS cho custom domain của bạn. Sau khi xác định URL cuối cùng, đặt `PUBLIC_ORIGIN` đúng URL gốc (gồm `https://`) trong Environment và restart.
8. Trong **Console**, xem log `GVCN 360 listening on 0.0.0.0:<assigned-port> · postgresql-jsonb`. Nếu không hiện, kiểm tra nguyên nhân.

## Phần C: Xác nhận dữ liệu không mất sau khi chia sẻ link

1. Mở `https://<domain-của-bạn>/api/health`. Mong đợi:
   `{"ok":true,"storage":"postgresql-jsonb","version":"2.0.0"}`.
   Nếu trả 503: có vấn đề DB/TLS/mạng — KHÔNG nhập dữ liệu thật trước khi xử lý.
2. Mở trang chủ domain, nhập mật khẩu nhóm. Thử thêm 1 học sinh **GIẢ**.
3. Trên điện thoại/trình duyệt khác, mở đúng domain và đăng nhập, nhìn thấy học sinh vừa thêm. Cần reload để thấy dữ liệu mới nhất (chưa có realtime).
4. Tắt và mở lại trình duyệt; dữ liệu vẫn có. Thử restart workload Node.js; dữ liệu vẫn có. Thử redeploy source; dữ liệu vẫn có vì database là workload khác.
5. Chỉ thử backup/restore trên bản sao hoặc dữ liệu test; restore có thể thay dữ liệu hiện có.

## Phần D: Khi muốn giữ dữ liệu JSON cũ

Có hai trường hợp:

**Chưa khởi tạo database**:
- Nếu đang giữ dữ liệu cũ trong `backend/data/*.json` và có quyền sử dụng dữ liệu đó, đặt `SEED_DEMO_DATA=true` trước lần `npm start` đầu tiên với DB mới. Các hàng database sẽ được `INSERT ... ON CONFLICT DO NOTHING`, KHÔNG ghi đè sau này.
- Tuyệt đối không đưa dữ liệu học sinh thật vào GitHub công khai hoặc ZIP chia sẻ. Chỉ dùng đường chuyển dữ liệu bảo mật nội bộ.

**Đã khởi tạo database**:
- Bật `SEED_DEMO_DATA=true` không cập nhật bản ghi đã tồn tại. Cần quy trình nhập dữ liệu riêng, có backup và xác nhận trước khi thay thế. Không dùng nút reset/recreate database để nhập thử.

## Phần E: Sao lưu, domain và quyền truy cập

- Tài liệu Botkeep cho biết có khả năng tạo/tải/khôi phục backup tại panel; cần **dừng database trước khi tạo file backup hoặc restore**. Giữ một bản backup riêng ngoài Botkeep, không dựa duy nhất vào service.
- Lệnh `npm run export-json` xuất 8 collection thành JSON trong `backups/`. Những file này nhạy cảm; chuyển qua nơi an toàn rồi xóa khỏi host nếu không có nhu cầu lưu thêm. Xuất JSON không bảo đảm snapshot transaction cho nhiều collection đồng thời; backup DB của Botkeep vẫn là lựa chọn ưu tiên.
- Không để public password trong code và không chia sẻ trực tiếp quyền quản lý tài khoản Botkeep cho người xem website.
- Hiện chỉ có **1 mật khẩu nhóm**: ai biết mật khẩu có thể xem/sửa toàn bộ dữ liệu trong ứng dụng. Chưa có tài khoản riêng, phân quyền vai trò, audit log hoặc giới hạn theo lớp. Với dữ liệu thật, cần bổ sung bảo mật/phân quyền và quy trình xin phép hợp lệ trước khi chia sẻ rộng.
- Chỉ cần share domain HTTPS cho người sử dụng được ủy quyền; **không share `DATABASE_URL`**.

## Phần F: Gỡ lỗi

| Hiện tượng | Nơi cần kiểm tra |
|---|---|
| Trang không mở | Domains HTTPS, Network port, `HOST=0.0.0.0` |
| Server báo missing package `pg` | Bước install `npm install`, kiểm tra npm registry/network ở build |
| App từ chối khởi động | Có đặt `NODE_ENV=production` mà thiếu `DATABASE_URL`, `APP_PASSWORD` hoặc `SESSION_SECRET` không? |
| API health 503 | Kiểm tra host/port/username/password DB, firewall/private network, TLS CA, trạng thái PostgreSQL |
| TLS / certificate verify failed | Cấu hình TLS/CA trong Database tab; dùng chứng chỉ/hostname chính xác. Đừng tắt xác thực chứng chỉ trên kết nối công khai |
| Login đúng nhưng POST 403 Origin | `PUBLIC_ORIGIN` chưa trùng domain HTTPS cuối cùng hoặc proxy không chuyển `X-Forwarded-Host` |
| Trang mở nhưng dữ liệu demo trống | `SEED_DEMO_DATA=false`: đây là chủ ý để DB mới không chứa học sinh demo |
| Reload/redeploy bị mất dữ liệu | Kiểm tra `GET /api/health` có đúng `postgresql-jsonb`; có xóa workload database hoặc trỏ sang DATABASE_URL khác không? |

## Giới hạn của việc nối tự động

Tôi chưa có quyền đăng nhập bảng điều khiển riêng của bạn ở `https://botkeep.cloud/app` và bạn chưa cung cấp dữ liệu kết nối hợp lệ qua một kênh secret được ủy quyền. Vì vậy các file đã được cấu hình **sẵn sàng deploy**, nhưng **chưa được upload/kích hoạt trên Botkeep**. Không nên gửi credential qua chat để giải quyết việc này.
