# Spesifikasi Desain Arsitektur: 2D Top-Down MMORPG Engine

- **Tanggal**: 2026-10-03
- **Target**: Portofolio Seleksi Google Developer Group on Campus (GDGoC) Universitas Gunadarma (Jalur Hacker)
- **Status**: Disetujui (Approved)
- **Tech Stack**: TypeScript (Strict Mode), Vite, HTML5 Canvas 2D API, Vitest

---

## 1. Latar Belakang & Tujuan

Project ini berevolusi dari 2D platformer menjadi **2D Top-Down MMORPG (Simulated Online World)**. Tujuannya adalah membuktikan kemampuan software engineering dan penguasaan game engine architecture di browser:
1. Pemanfaatan ulang (reuse) arsitektur dasar yang telah teruji: Fixed Timestep GameLoop (60 FPS logic deterministik + render interpolation), type-safe ECS World, InputManager, Camera2D, dan Vector2/AABB math.
2. Implementasi simulasi multiplayer lokal (Simulated MMO World) sehingga game terasa hidup dengan kehadiran bot pemain lain yang berburu monster, berinteraksi, dan mengirimkan pesan di global chat tanpa memerlukan backend server eksternal.
3. Fitur lengkap RPG: Top-down 8-directional movement dengan sliding collision, sistem status (HP, MP, Level, EXP, Gold), sistem combat dengan Basic Attack dan Skill Cooldown, Critical Hit, Floating Damage Numbers, Monster AI dengan mekanik leashing, Depth Y-Sorting untuk kedalaman perspektif, dan in-game chat log.

---

## 2. Arsitektur Komponen ECS (Data Containers)

Seluruh data entitas disimpan dalam bentuk komponen murni tanpa method logika bisnis:

### 2.1. TransformComponent & VelocityComponent
- Menyimpan koordinat dunia `x`, `y` beserta `prevX`, `prevY` untuk interpolasi render.
- Menyimpan kecepatan `vx`, `vy` dalam pixel/detik.

### 2.2. StatsComponent
Menyimpan atribut RPG entitas (Pemain, Bot, dan Monster):
- `hp: number`, `maxHp: number`: Darah entitas.
- `mp: number`, `maxMp: number`: Mana untuk mengeluarkan skill.
- `level: number`, `exp: number`, `nextLevelExp: number`: Sistem progres leveling.
- `attack: number`, `defense: number`: Atribut tempur dasar.
- `critChance: number`, `critMultiplier: number`: Peluang dan pengali damage critical.
- `gold: number`: Mata uang dalam game.
- `hpPotions: number`, `mpPotions: number`: Stok persediaan potion pemulih.

### 2.3. CombatComponent
Mengelola kapabilitas penyerangan:
- `attackRange: number`: Jarak jangkauan serangan melee biasa (pixel).
- `attackCooldown: number`: Durasi jeda antar-serangan (detik).
- `currentAttackCooldown: number`: Timer cooldown serangan saat ini.
- `skillName: string`: Nama jurus aktif (contoh: "Whirlwind Slash").
- `skillCostMp: number`: Biaya mana untuk jurus.
- `skillCooldown: number`: Durasi cooldown jurus.
- `currentSkillCooldown: number`: Timer cooldown jurus.
- `skillRange: number`: Jangkauan jurus.
- `skillMultiplier: number`: Pengali damage jurus (contoh: 2.2x).
- `isAttacking: boolean`: Flag visual animasi tebasan.

### 2.4. NameplateComponent
Mengelola informasi visual di atas kepala entitas:
- `name: string`: Nama entitas (contoh: "Azyte [Lv.1]", "Forest Slime", "Knight_Rider").
- `role: 'player' | 'other_player' | 'monster' | 'npc'`: Kategori peran.
- `title: string`: Judul guild atau deskripsi (contoh: "<Guild Master>").
- `showHealthBar: boolean`: Menentukan apakah bar HP ditampilkan di atas kepala.

### 2.5. MonsterAIComponent
State machine kecerdasan buatan untuk monster liar:
- `state: 'idle' | 'patrol' | 'chase' | 'attack' | 'return'`: Status perilaku.
- `stateTimer: number`: Timer durasi state.
- `homeX: number`, `homeY: number`: Posisi sarang asal untuk patroli dan leashing.
- `aggroRadius: number`: Jarak deteksi musuh untuk mulai mengejar.
- `leashRadius: number`: Batas jarak maksimal mengejar sebelum monster kembali ke sarang.
- `targetEntity: Entity | null`: Entitas yang sedang ditarget.

### 2.6. SimulatedPlayerComponent
State machine untuk bot pemain lain dalam simulasi MMO:
- `behavior: 'farming' | 'exploring'`: Pola perilaku bot.
- `targetMonster: Entity | null`: Monster yang sedang diburu.
- `chatCooldown: number`: Timer pengiriman pesan chat berkala.

### 2.7. FloatingTextComponent
Teks pop-up angka damage, perolehan EXP, dan pengumuman level up:
- `text: string`: Teks yang ditampilkan (contoh: "-24", "CRIT! -48", "+35 EXP").
- `color: string`: Warna teks (merah untuk damage, kuning untuk critical/EXP, hijau untuk heal).
- `lifetime: number`, `elapsed: number`: Durasi eksistensi teks sebelum dihapus.
- `vy: number`: Kecepatan melayang vertikal ke atas.

---

## 3. Alur Kerja Sistem ECS (Systems Pipeline)

Urutan eksekusi sistem pada setiap fixed timestep 60Hz:

```text
Fixed Timestep Update (dt = 0.016s)
1. TopDownPlayerInputSystem:
   - Membaca input keyboard WASD / Panah untuk arah gerak 8 arah.
   - Normalisasi vektor diagonal (vx, vy).
   - Menangani tombol aksi: Spasi (Basic Attack), K/1 (Skill), Q (HP Potion), E (MP Potion).

2. MonsterAISystem:
   - Evaluasi state: Idle -> Patrol di sekitar homeX/Y.
   - Pengecekan radius deteksi (aggroRadius) terhadap Player maupun Simulated Players.
   - Pengecekan leashing: jika target > leashRadius, beralih ke state Return dan regenerasi HP.
   - Jika dalam attackRange, picu serangan monster ke target.

3. SimulatedMMOPlayerSystem:
   - Mencari monster hidup terdekat di peta.
   - Menggerakkan bot mendekati monster dan menyerang.
   - Memakai HP potion otomatis jika HP < 30%.
   - Mengirim pesan acak ke global chat log (LFG, quest tips, ding level up).

4. TopDownMovementSystem:
   - Memperbarui koordinat transform entitas.
   - Sliding Collision Resolution: Resolusi tabrakan terhadap rintangan solid (pohon, batu, bangunan)
     secara terpisah pada sumbu X lalu Y, memungkinkan karakter meluncur mulus sepanjang rintangan.

5. CombatSystem:
   - Mengurangi timer cooldown serangan dan skill.
   - Kalkulasi damage: BaseDamage = max(1, Atk - TargetDef) * (isCrit ? CritMultiplier : 1.0).
   - Mengurangi HP target dan menembakkan FloatingTextComponent.
   - Menangani kematian monster: memberi EXP & Gold ke penyerang, menjadwalkan respawn setelah 5 detik.
   - Menangani Level Up: jika EXP >= nextLevelExp, tingkatkan level, pulihkan HP/MP penuh, naikkan status.

6. FloatingTextSystem:
   - Menggerakkan teks ke atas dan menghapus entitas teks saat lifetime habis (queueDestroy).

7. CameraFollowSystem:
   - Kamera 2D mengikuti posisi pemain utama dengan smooth lerp damping dan clamping batas peta.

Render Phase (requestAnimationFrame)
8. MMORenderSystem:
   - Bersihkan canvas dan terapkan translasi kamera.
   - Gambar ubin tanah (rumput, jalan setapak, sungai, bunga).
   - Gambar rintangan solid (pohon, bebatuan).
   - Depth Y-Sorting: Urutkan seluruh entitas berdasarkan koordinat Y bawah (kaki) sebelum digambar,
     sehingga karakter bisa berjalan di depan dan di belakang pohon dengan perspektif kedalaman nyata.
   - Gambar floating nameplate dan bar HP di atas kepala entitas.
   - Gambar teks damage mengambang.
   - Gambar HUD RPG (Bar HP/MP, Potion hotbar, EXP bar, dan Interactive Chat Box).
```

---

## 4. Mitigasi Edge Case Teknis

1. **Diagonal Speed Boost Bug**:
   - Menekan W + D tanpa normalisasi membuat kecepatan bertambah menjadi `sqrt(1^2 + 1^2) = 1.414` (41% lebih cepat).
   - Mitigasi: Vektor arah selalu dinormalisasi sebelum dikalikan dengan kecepatan lari.
2. **Infinite Kiting & Monster Wandering Exploit**:
   - Jika monster terus mengejar tanpa batas, pemain bisa memancing monster ke sudut peta tanpa risiko.
   - Mitigasi: Sistem leashing menghitung jarak dari `homeX, homeY`. Jika melebihi `leashRadius`, monster membatalkan target, kebal sementara, dan berlari kembali ke sarang sambil meregenerasi darah.
3. **Occlusion & Depth Sorting Error**:
   - Tanpa depth sorting, monster atau pohon yang berada di depan pemain bisa tertimpa oleh render pemain yang digambar belakangan.
   - Mitigasi: Semua objek visual di-sort berdasarkan posisi kaki (`y + height`) sebelum dipanggil `ctx.fillRect / drawImage`.
4. **Chat Box Overflow**:
   - Pesan chat yang menumpuk bisa memakan memori browser.
   - Mitigasi: Chat buffer dibatasi maksimal 50 pesan terakhir (FIFO ring buffer).

---

## 5. Rencana Pengujian (Testing Strategy)

Unit test Vitest akan menguji modul-modul ini secara terisolasi:
1. `Stats & Combat Test`:
   - Formula kalkulasi damage dasar dan critical hit.
   - Level Up memicu penambahan status dan pemulihan HP/MP.
   - Potion memulihkan HP/MP dan mengurangi jumlah item di tas.
2. `Monster AI Test`:
   - Transisi state dari Idle ke Chase saat target berada di dalam radius aggro.
   - Transisi ke Return saat target melarikan diri melebihi radius leash.
3. `TopDown Sliding Collision Test`:
   - Karakter yang bergerak diagonal menabrak dinding tetap bisa meluncur pada sumbu yang bebas.
4. `Depth Sorting Test`:
   - Memvalidasi urutan render array berdasarkan koordinat Y.
