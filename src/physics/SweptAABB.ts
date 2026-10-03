import { AABB } from './AABB';

export interface SweptResult {
  /**
   * Fraksi waktu terjadinya tabrakan dalam rentang [0.0, 1.0].
   * 0.0 = tabrakan terjadi di awal pergerakan.
   * 1.0 = tidak terjadi tabrakan sepanjang pergerakan.
   */
  time: number;
  /** Normal permukaan sumbu X (-1 = tabrak dari kiri ke kanan, 1 = tabrak dari kanan ke kiri, 0 = tidak ada). */
  normalX: number;
  /** Normal permukaan sumbu Y (-1 = mendarat di lantai, 1 = membentur langit-langit, 0 = tidak ada). */
  normalY: number;
}

/**
 * Menghasilkan Bounding Box Broadphase yang melingkupi posisi awal dan posisi tujuan kotak yang bergerak.
 * Digunakan sebagai filter cepat sebelum kalkulasi Swept AABB.
 * @param box Kotak AABB asal
 * @param vx Kecepatan horizontal (pixel/detik)
 * @param vy Kecepatan vertikal (pixel/detik)
 * @param dt Delta time (detik)
 * @param out Objek AABB penampung hasil (opsional, untuk zero-allocation)
 */
export function getBroadphaseBox(
  box: AABB,
  vx: number,
  vy: number,
  dt: number,
  out?: AABB
): AABB {
  const dx = vx * dt;
  const dy = vy * dt;

  const result = out ?? new AABB();
  result.x = dx > 0 ? box.x : box.x + dx;
  result.y = dy > 0 ? box.y : box.y + dy;
  result.width = box.width + Math.abs(dx);
  result.height = box.height + Math.abs(dy);

  return result;
}

/**
 * Mendeteksi tabrakan kontinyu (Continuous Collision Detection - CCD) antara kotak bergerak dan rintangan statis.
 * Mencegah tunneling (menembus dinding/lantai tipis pada kecepatan tinggi).
 *
 * @param box Kotak AABB yang bergerak
 * @param vx Kecepatan X kotak (pixel/detik)
 * @param vy Kecepatan Y kotak (pixel/detik)
 * @param dt Delta time per frame (detik)
 * @param obstacle Kotak AABB rintangan statis
 * @param out Objek SweptResult penampung hasil (opsional, untuk zero-allocation)
 * @returns SweptResult dengan nilai time [0, 1] dan vektor normal tabrakan
 */
export function sweptAABB(
  box: AABB,
  vx: number,
  vy: number,
  dt: number,
  obstacle: AABB,
  out?: SweptResult
): SweptResult {
  const result: SweptResult = out ?? { time: 1.0, normalX: 0, normalY: 0 };
  result.time = 1.0;
  result.normalX = 0;
  result.normalY = 0;

  const dx = vx * dt;
  const dy = vy * dt;

  // 1. Hitung jarak masuk (entry distance) dan jarak keluar (exit distance)
  let invEntryX: number;
  let invEntryY: number;
  let invExitX: number;
  let invExitY: number;

  if (dx > 0) {
    invEntryX = obstacle.minX - (box.x + box.width);
    invExitX = obstacle.maxX - box.x;
  } else {
    invEntryX = obstacle.maxX - box.x;
    invExitX = obstacle.minX - (box.x + box.width);
  }

  if (dy > 0) {
    invEntryY = obstacle.minY - (box.y + box.height);
    invExitY = obstacle.maxY - box.y;
  } else {
    invEntryY = obstacle.maxY - box.y;
    invExitY = obstacle.minY - (box.y + box.height);
  }

  // 2. Hitung waktu masuk dan keluar pada masing-masing sumbu
  // ⚠️ EDGE CASE: Kecepatan mendekati atau sama dengan nol (dx === 0 atau dy === 0).
  // Di JavaScript, pembagian dengan nol menghasilkan Infinity atau -Infinity.
  let entryX = dx === 0 ? -Infinity : invEntryX / dx;
  let entryY = dy === 0 ? -Infinity : invEntryY / dy;
  let exitX = dx === 0 ? Infinity : invExitX / dx;
  let exitY = dy === 0 ? Infinity : invExitY / dy;

  // Pastikan entry time selalu lebih kecil daripada exit time jika arahnya negatif
  if (entryX > exitX) {
    const temp = entryX;
    entryX = exitX;
    exitX = temp;
  }
  if (entryY > exitY) {
    const temp = entryY;
    entryY = exitY;
    exitY = temp;
  }

  // Waktu tabrakan pertama terjadi ketika kedua sumbu telah masuk (irisan interval)
  const entryTime = Math.max(entryX, entryY);
  // Waktu tabrakan berakhir ketika salah satu sumbu telah keluar
  const exitTime = Math.min(exitX, exitY);

  // 3. Evaluasi apakah tabrakan benar-benar terjadi
  // Tidak terjadi tabrakan jika:
  // - Sumbu keluar mendahului sumbu masuk (entryTime > exitTime)
  // - Objek bergerak menjauhi rintangan di kedua sumbu (entryX < 0 && entryY < 0)
  // - Tabrakan baru terjadi setelah delta time berakhir (entryTime > 1.0)
  // - Objek sudah berada di masa lalu sebelum pergerakan dimulai (entryTime < 0.0)
  if (
    entryTime > exitTime ||
    (entryX < 0 && entryY < 0) ||
    entryTime > 1.0 ||
    entryTime < 0.0
  ) {
    return result;
  }

  // 4. Tabrakan terjadi! Tentukan sumbu mana yang menjadi permukaan benturan
  result.time = entryTime;

  if (entryX > entryY) {
    // Tabrakan terjadi pada sumbu horizontal (X)
    result.normalX = dx > 0 ? -1 : 1;
    result.normalY = 0;
  } else {
    // Tabrakan terjadi pada sumbu vertikal (Y)
    result.normalX = 0;
    result.normalY = dy > 0 ? -1 : 1;
  }

  return result;
}
