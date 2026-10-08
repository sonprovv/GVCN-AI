# Hướng Dẫn Deploy GVCN 360 Lên Vercel (Kết Nối PostgreSQL Botkeep)

## 1. Giới thiệu kiến trúc
- **Frontend & CDN**: Vercel Edge Network (cấp HTTPS miễn phí, CDN toàn cầu cực nhanh).
- **Backend API**: Vercel Serverless Function (`api/index.js` định tuyến tất cả `/api/*`).
- **Database**: PostgreSQL lưu trữ trên Botkeep (`37.187.29.146:33737`). Đã kiểm tra kết nối trực tiếp từ bên ngoài thành công 100%.

---

## 2. Các biến môi trường cần cấu hình trên Vercel

Vào **Project Settings** > **Environment Variables** trên Vercel và thêm 5 biến sau:

| Tên biến | Giá trị |
| :--- | :--- |
| `DATABASE_URL` | `postgresql://botkeep:Ah0cbeir3FTxAJzO_ha30NxbOFcJ8ZN0SOwMhOkqd4Q@37.187.29.146:33737/app` |
| `PGSSL_MODE` | `no-verify` |
| `APP_PASSWORD` | `gvcn360admin2024` *(hoặc mật khẩu bất kỳ dài >= 12 ký tự)* |
| `SESSION_SECRET` | `gvcn360secretkey1234567890abcdef1234567890abcdef1234567890abcdef12` |
| `NODE_ENV` | `production` |

---

## 3. Cách deploy

### Cách 1: Qua GitHub (Khuyên dùng nhất - Tự động cập nhật mỗi khi commit)
1. Tạo một repository mới trên GitHub (Private hoặc Public).
2. Chạy lệnh đẩy code từ thư mục này lên GitHub:
   ```powershell
   git branch -M main
   git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git
   git push -u origin main
   ```
3. Truy cập [vercel.com/new](https://vercel.com/new), chọn **Import** repository vừa tạo.
4. Dán 5 biến môi trường ở mục 2 vào phần **Environment Variables**.
5. Nhấn **Deploy**.

---

### Cách 2: Deploy trực tiếp bằng Vercel CLI trong Terminal
1. Đăng nhập Vercel:
   ```powershell
   npx vercel login
   ```
2. Thực hiện deploy:
   ```powershell
   npx vercel --prod
   ```
3. Sau khi deploy lần đầu, vào Dashboard Vercel thêm các biến môi trường ở mục 2, rồi redeploy lại 1 lần là hoàn tất.
