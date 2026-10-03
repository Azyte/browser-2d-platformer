# Browser 2D Platformer Engine (Custom TypeScript Engine)

> Custom 2D Game Engine yang dibangun dari nol (from scratch) menggunakan **TypeScript** dan **HTML5 Canvas 2D API** tanpa library engine pihak ketiga (bukan Phaser, bukan Unity).
> Dibuat sebagai portofolio seleksi **Google Developer Group on Campus (GDGoC) Universitas Gunadarma (Jalur Hacker)**.

---

## Arsitektur & Fitur Teknis Utama

### 1. Fixed Timestep GameLoop (Accumulator Pattern)
- Memisahkan kecepatan tick logika/fisika game (**60 FPS deterministik**) dari frame rate monitor (60Hz, 120Hz, 144Hz).
- Menggunakan akumulator waktu dan **Render Interpolation Alpha** (`[0, 1]`) untuk rendering mulus tanpa stutter.
- Dilengkapi proteksi **Spiral of Death** (`maxFrameTime` clamp) untuk mencegah browser freeze saat tab diminimize atau dibuka kembali.

### 2. Type-Safe ECS Architecture (Entity-Component-System)
- Menghindari kerapuhan OOP inheritance dengan komposisi data murni:
  - **Entity**: Integer ID unik.
  - **Component**: Pure data container tanpa metode logika bisnis.
  - **System**: Fungsi pengolah data yang memproses entitas berdasarkan kombinasi komponen.
- Type-safe di **TypeScript Strict Mode** tanpa menggunakan tipe `any`.
- Optimasi query store terkecil terlebih dahulu untuk efisiensi CPU.
- Fitur `queueDestroy` untuk mencegah crash modifikasi array saat sistem melakukan iterasi query.

### 3. Deterministic InputManager
- Polling state tombol (`isActionDown`, `isActionJustPressed`, `isActionJustReleased`).
- Action mapping yang memisahkan tombol fisik (WASD, Panah) dari maksud gameplay.
- Penanganan edge case browser:
  - Mencegah scrolling halaman akibat tombol panah dan spasi (`preventDefault`).
  - Mengabaikan `event.repeat` browser pada aksi sekali tekan.
  - Reset tombol otomatis saat browser kehilangan fokus (`window.onblur`).

### 4. Camera 2D & Viewport Culling
- Translasi dua arah antara **World Coordinates** dan **Screen Coordinates**.
- **Smooth Damping (Lerp)** untuk pergerakan kamera halus mengikuti pemain.
- **Deadzone Box** untuk mencegah micro-jitter saat pemain berbalik arah.
- **Viewport Culling**: Melewati proses rendering entitas yang berada di luar jangkauan kamera untuk menghemat draw calls canvas.

### 5. Vector2 Math & AABB Collision Primitives
- `Vector2` mendukung operasi in-place mutation dan reusable static `out` buffer untuk zero-allocation di hot loop.
- `AABB` (Axis-Aligned Bounding Box) dengan deteksi irisan dan kalkulasi **Minimum Translation Vector (MTV)** untuk resolusi tabrakan dinding dan lantai.
- Penanganan edge case corner collision pada platformer 2D.

---

## Tech Stack

- **Language**: TypeScript (Strict Mode: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`)
- **Rendering**: HTML5 Canvas 2D API
- **Build Tool**: Vite
- **Testing**: Vitest (Unit Tests & Integration Tests)
- **Deployment**: GitHub Pages / Vercel

---

## Cara Menjalankan Project

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Development Server
```bash
npm run dev
```
Buka browser pada URL lokal yang ditampilkan (biasanya `http://localhost:5173`).

### 3. Jalankan Pengujian Unit Test
```bash
npm run test
```

### 4. Build untuk Produksi
```bash
npm run build
```
Hasil build bundler akan berada di folder `dist/`.
