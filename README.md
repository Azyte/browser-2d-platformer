# Aethelgard 2D: Top-Down MMORPG Engine (Custom TypeScript Engine)

> Custom 2D MMORPG Engine yang dibangun dari nol (*from scratch*) menggunakan **TypeScript** dan **HTML5 Canvas 2D API** tanpa library game pihak ketiga (tanpa Phaser, tanpa Pixi, tanpa Unity).
> Dibuat sebagai portofolio seleksi **Google Developer Group on Campus (GDGoC) Universitas Gunadarma (Jalur Hacker)**.

🎮 **Live Demo GitHub Pages**: [https://azyte.github.io/browser-2d-platformer/](https://azyte.github.io/browser-2d-platformer/)  
📦 **Unit Test Suite**: 20 Test Suites, **92 Unit Tests 100% Passing**

---

## 🌟 Arsitektur & Keunggulan Rekayasa Engine

### 1. Fixed Timestep GameLoop (Accumulator Pattern)
- Memisahkan tick logika/fisika (**60 Hz deterministik**) dari refresh rate layar monitor (60Hz, 120Hz, 144Hz).
- **Render Interpolation Alpha** (`alpha = accumulator / dt`): Menghasilkan interpolasi koordinat visual super halus (*silky smooth*) tanpa stutter.
- **Spiral of Death Clamp**: Mencegah browser freeze atau crash saat tab browser diminimize atau dibuka kembali dengan pembatasan `maxFrameTime`.

### 2. Type-Safe Data-Oriented ECS (Entity-Component-System)
- Menggantikan hierarki pewarisan OOP yang kaku dengan arsitektur data murni berkinerja tinggi:
  - **Entity**: Integer ID unik.
  - **Component**: Pure data container tanpa dependensi logika (*Transform, Velocity, Collider, Stats, Combat, Nameplate, MonsterAI, SimulatedPlayer, LootDrop, NPCComponent, InventoryComponent*).
  - **System**: Fungsi pengolah yang memproses entitas berdasarkan query komponen secara batch.
- Query didesain dengan memilih store komponen terkecil terlebih dahulu untuk efisiensi CPU cache.
- Mekanisme `queueDestroy` untuk mencegah mutasi array saat query iterasi sedang berjalan di hot loop.

### 3. Top-Down Movement & Sliding Collision Resolution
- **Diagonal Speed Normalization**: Mengeliminasi bug pergerakan miring (W+D) yang biasanya 41% lebih cepat (`sqrt(1^2 + 1^2) = 1.414`) dengan normalisasi vektor arah ke panjang 1.0.
- **Axis-Separated Sliding Collision**: Resolusi tabrakan terhadap rintangan lingkungan padat (pohon, batu granit, batas peta) diselesaikan secara independen pada sumbu X lalu Y. Karakter dapat meluncur mulus (*smooth sliding*) di sepanjang rintangan tanpa tersangkut.

### 4. Depth Y-Sorting (Z-Ordering 2.5D Perspective)
- Objek, NPC, dan karakter diurutkan secara dinamis berdasarkan posisi alas kaki (`baseY = y + height`).
- Karakter dapat melangkah di balik kanopi daun pohon atau di belakang NPC saat berada di atas posisinya, dan tampil di depan saat berjalan di bawahnya, menciptakan ilusi perspektif kedalaman nyata.

### 5. Sistem Tempur RPG & Progresi Level
- Formula kalkulasi kerusakan fisik: `BaseDamage = max(1, Atk - TargetDef) * (isCrit ? CritMultiplier : 1.0)`.
- Jurus aktif **Whirlwind Slash** (damage area 2.2x multiplier, radius 75px, konsumsi 20 MP).
- Ramuan pemulih HP (+50 HP) dan MP (+35 MP) dengan konsumsi instan.
- **Level Up Otomatis**: Saat EXP mencapai batas target, level karakter naik, status tempur (HP Max, MP Max, Atk, Def) meningkat permanen, dan darah/mana pulih penuh.

### 6. Monster AI Finite State Machine & Anti-Kiting Leash
- State machine musuh: *Idle*, *Patrol* (berkeliling di sekitar sarang), *Chase* (mengejar target saat masuk radius aggro), *Attack*, dan *Return*.
- **Anti-Kiting Leash Mechanism**: Mencegah eksploitasi kiting tanpa batas. Jika monster terpancing menjauhi sarang melebihi `leashRadius`, monster membatalkan target, kebal sementara, dan berlari kembali ke sarang sambil meregenerasi darah penuh.
- **Respawn Queue**: Monster yang tewas dijadwalkan hidup kembali di koordinat sarangnya setelah 5 detik.

### 7. Simulated Online MMO World (Autonomous Player Bots)
- 4 bot pemain otonom yang mensimulasikan lingkungan MMORPG daring tanpa membutuhkan server backend:
  - **Valkyrie** (Swordmaster: Zirah baja kirmisi, jubah biru langit, helm bersayap, pedang Zweihander).
  - **ShadowBlade** (Shadow Rogue: Jubah ninja obsidian, selendang ungu berkibar, belati ganda beracun).
  - **Merlin** (Archmage: Jubah biru bertabur bintang, topi kerucut penyihir, tongkat kristal bercahaya).
  - **HealerKun** (High Cleric: Jubah liturgis putih-emas, lingkaran halo suci di atas kepala, gada matahari).
- Bot secara mandiri mencari monster, bertarung, meminum potion jika darah sekarat (<30%), dan mengobrol secara dinamis di log percakapan global.

### 8. Interactive NPC & Branching Dialogue System
- **Tetua Rowan (Town Elder & Sage)**: NPC penjaga pusat Sanctuary dengan visual jubah zamrud, jenggot putih, tongkat kayu ek, dan floating golden quest marker (`!`).
- **Proximity Prompt**: Mendeteksi jarak pemain dan menampilkan pill badge interaktif `[F] Talk to Elder Rowan`.
- **Branching Dialogue Tree**: Dialog interaktif bercabang dengan pilihan numerik (1, 2, 3 atau klik mouse) untuk mendengarkan lore dunia, meminta Berkah Pemulihan Darah (Blessing of Sanctuary), dan pamit bertualang.

### 9. Visual Inventory & Equipment Paperdoll Modal
- **Equipment Slots**: Slot perlengkapan dinamis (Weapon, Armor, Accessory) yang langsung merefleksikan bonus serangan, pertahanan, dan darah maksimal ke status karakter.
- **Bag Grid (16 Slots)**: Manajemen tas dengan penumpukan item otomatis (*item stacking*), pembagian kategori (Senjata, Zirah, Aksesori, Konsumsi, Material), dan badge kuantitas.
- **Interactive Modal**: Tampilan modal RPG transparan yang dapat dibuka/tutup dengan tombol `[I]`, `[B]`, atau tombol sentuh `[BAG]`, lengkap dengan tooltip deskripsi dan aksi pasang/pakai langsung.

### 10. Day/Night Dynamic Cycle & Radial Lighting
- **Siklus Waktu 24 Jam**: Bergulir mulus melewati 4 fase (Fajar, Siang Cerah, Senja Lembayung, Malam Pekat).
- **Radial Lighting Mask**: Menggunakan teknik `destination-out` dan gradien radial dinamis pada HTML5 Canvas untuk memotong kegelapan malam di sekitar sumber cahaya (obor pemain, lentera bot, api unggun perkemahan, dan aura ungu Fenrir).

### 11. Procedural Web Audio SFX Synthesizer (Zero Asset Audio)
- Menghasilkan efek suara retro/arcade 16-bit secara langsung dari kode melalui Web Audio API tanpa perlu mengunduh file `.mp3` atau `.wav`:
  - Tebasan pedang (*Sawtooth pitch slide*)
  - Benturan pukulan & Critical Hit (*Metallic chime + punchy bass*)
  - Pusaran jurus Whirlwind (*Sweeping pitch vortex*)
  - Ramuan minum (*Ascending liquid pentatonic tones*)
  - Fanfare kenaikan level (*Triumphant major arpeggio C-E-G-C*)
  - Pengambilan loot koin (*Chime sparkle*)

### 12. Quest Tracker & Ground Loot Drops
- **Sistem Misi (Quests)**: Pelacak objektif perburuan monster berhadiah koin emas dan EXP.
- **Loot Drop di Tanah**: Monster menjatuhkan kantong koin emas berkilauan, botol ramuan, dan item langka (*Fenrir Crest*) yang dapat diambil saat pemain mendekatinya (*auto-pickup*).

### 13. Engine Debug Overlay (F3) & Mobile Gamepad
- **Tombol F3 / Debug UI**: Menampilkan visualisasi kotak tabrakan (*AABB hitboxes* warna hijau untuk entitas, merah untuk rintangan padat), lingkaran radius Aggro (kuning) & Leash (oranye) monster, dan vektor kecepatan.
- **Mobile Virtual Touch Gamepad**: D-Pad dan tombol aksi sentuh (ATK, SKILL, TALK, BAG, HP, MP) di bawah canvas yang mendukung layar sentuh smartphone maupun klik mouse desktop.
- **Stress Test Tool**: Tombol `+20 Slimes` dan `+4 Bots` untuk menguji stabilitas FPS engine di bawah beban puluhan entitas aktif.

---

## 🎮 Panduan Kontrol

| Tombol Keyboard | Tombol Sentuh Mobile | Aksi |
| :--- | :--- | :--- |
| **W, A, S, D** / **Panah** | **D-Pad (▲, ▼, ◄, ►)** | Jalan 8 Arah (Normalisasi diagonal) |
| **Space** / **J** | **ATK** | Serangan Dasar Pedang (Basic Attack) |
| **K** / **1** | **SKILL** | Jurus Area Whirlwind Slash (20 MP) |
| **F** | **TALK** | Bicara dengan NPC (Tetua Rowan) / Dialog Interaktif |
| **I** / **B** | **BAG** | Buka / Tutup Tas Inventaris & Equipment Paperdoll |
| **1, 2, 3** | **Klik Mouse / Touch** | Memilih Opsi Jawaban Dialog NPC |
| **1 s/d 8** | **Klik Slot** | Memasang / Menggunakan Item dari Tas Inventaris |
| **Q** | **HP** | Minum Ramuan Darah (+50 HP) |
| **E** | **MP** | Minum Ramuan Mana (+35 MP) |
| **Escape** | **[X] Close** | Menutup Jendela Dialog NPC atau Modal Inventaris |
| **F3** / Tombol UI | **Debug Button** | Toggle Visualisasi Hitbox & Radar AI |

---

## 🛠️ Tech Stack & Standar Kualitas

- **Bahasa**: TypeScript (Strict Mode: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `exactOptionalPropertyTypes`)
- **Rendering**: HTML5 Canvas 2D API (60 FPS Fixed Timestep + Alpha Interpolation + Radial Lighting Masks)
- **Audio**: Web Audio API (Synthesizer Prosedural)
- **Bundler**: Vite
- **Testing**: Vitest (20 Test Suites, 92 Unit Tests 100% Passing)
- **Deployment**: GitHub Pages CI/CD Workflow

---

## 🚀 Menjalankan Project Secara Lokal

### 1. Kloning Repositori & Pasang Dependensi
```bash
git clone git@github.com:Azyte/browser-2d-platformer.git
cd browser-2d-platformer
npm install
```

### 2. Jalankan Server Development
```bash
npm run dev
```
Buka browser pada `http://localhost:5173`.

### 3. Jalankan Pengujian Unit Test
```bash
npm run test
```

### 4. Build Bundel Produksi
```bash
npm run build
```
Hasil build produksi teroptimasi akan dihasilkan di folder `dist/`.
