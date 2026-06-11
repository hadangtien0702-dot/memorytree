# Memory Tree 🌳

Cây ký ức công ty — website 3D lưu giữ kỷ niệm và gương mặt của các thành viên.
Mỗi nhân viên là một tấm ảnh polaroid treo bằng dây trên cây.

## Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:5173

## Cập nhật ảnh nhân viên

1. Thêm/bớt ảnh trong thư mục `public/employees/HÌNH ẢNH NHÂN VIÊN 2026/`
   (tên file = tên nhân viên, hỗ trợ jpg/png/jpeg/jfif)
2. Chạy 2 lệnh:

```bash
powershell -ExecutionPolicy Bypass -File scripts/prepare-photos.ps1
node scripts/generate-employees.cjs
```

App tự nhận số người mới và xếp lại vị trí trên cây.

## Chỉnh vị trí ảnh trên cây

- Click vào một tấm ảnh → kéo theo mũi tên để chỉnh vị trí
- Bấm **"Lưu & Copy Tọa Độ"** → dán nội dung clipboard đè vào `src/data/cardPositions.json` để cố định cho mọi người
- Bấm **"Reset Tạo Lại Ngẫu Nhiên"** để xáo lại toàn bộ

## Credits

- 3D model: ["Dryad's Tree"](https://sketchfab.com/3d-models/dryads-tree) by **H.Foucault**,
  licensed under [Creative Commons Attribution](https://creativecommons.org/licenses/by/4.0/).
  (Đã nén từ 110MB xuống 4.8MB bằng gltf-transform: Draco + WebP 1k textures.)
- Built with React, Three.js, @react-three/fiber, @react-three/drei, Vite.
