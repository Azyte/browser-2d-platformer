import { describe, it, expect } from 'vitest';
import { AABB } from './AABB';
import { sweptAABB, getBroadphaseBox, type SweptResult } from './SweptAABB';

describe('Physics: Swept AABB & Continuous Collision Detection (CCD)', () => {
  it('harus mencegah tunneling (menembus lantai tipis pada kecepatan tinggi)', () => {
    // Karakter berukuran 32x32 berada di y: 80..112
    const player = new AABB(50, 80, 32, 32);

    // Lantai tipis (tebal hanya 8 pixel) di y: 120..128
    const thinFloor = new AABB(0, 120, 200, 8);

    // Karakter jatuh bebas dengan kecepatan tinggi: 2400 pixel/detik
    // Dalam dt = 1/60s (0.01666s), karakter bergerak sejauh 40 pixel!
    // Posisi akhir karakter akan berada di y: 120 + 40 = 160.
    // Jika dicek secara diskrit biasa pada posisi akhir, karakter sudah melewati lantai (tunneling).
    const dt = 1 / 60;
    const vy = 2400; // Perpindahan per frame = 40px

    const result = sweptAABB(player, 0, vy, dt, thinFloor);

    // Tabrakan harus terdeteksi!
    // Jarak dari dasar pemain (y=112) ke lantai (y=120) adalah 8px.
    // 8px dari total perpindahan 40px berarti tabrakan terjadi pada time = 8 / 40 = 0.2
    expect(result.time).toBeCloseTo(0.2, 4);
    expect(result.normalX).toBe(0);
    expect(result.normalY).toBe(-1); // Normal mendorong ke atas (mendarat di lantai)
  });

  it('harus mendeteksi tabrakan horizontal ke dinding tipis pada kecepatan tinggi', () => {
    const player = new AABB(50, 50, 32, 32);
    const thinWall = new AABB(100, 0, 10, 200);

    const dt = 1 / 60;
    const vx = 3000; // Perpindahan = 50px

    // Jarak dari sisi kanan pemain (x=82) ke dinding (x=100) adalah 18px.
    // Time of impact = 18 / 50 = 0.36
    const result = sweptAABB(player, vx, 0, dt, thinWall);

    expect(result.time).toBeCloseTo(0.36, 4);
    expect(result.normalX).toBe(-1); // Normal ke arah kiri
    expect(result.normalY).toBe(0);
  });

  it('harus mengembalikan time = 1.0 jika objek bergerak menjauhi rintangan', () => {
    const player = new AABB(50, 50, 32, 32);
    const obstacle = new AABB(200, 50, 32, 32);

    // Bergerak ke arah kiri menjauhi rintangan di kanan
    const result = sweptAABB(player, -200, 0, 0.016, obstacle);
    expect(result.time).toBe(1.0);
    expect(result.normalX).toBe(0);
    expect(result.normalY).toBe(0);
  });

  it('harus menangani kecepatan nol (vx = 0, vy = 0) dengan aman tanpa menghasilkan NaN', () => {
    const player = new AABB(50, 50, 32, 32);
    const obstacle = new AABB(200, 50, 32, 32);

    const result = sweptAABB(player, 0, 0, 0.016, obstacle);
    expect(result.time).toBe(1.0);
    expect(isNaN(result.time)).toBe(false);
  });

  it('harus menghasilkan Broadphase Box yang mencakup seluruh rentang pergerakan', () => {
    const box = new AABB(100, 100, 30, 30);
    const vx = 120;
    const vy = -60;
    const dt = 0.5; // dx = 60, dy = -30

    const broadphase = getBroadphaseBox(box, vx, vy, dt);

    // X bergerak dari 100 ke kanan sejauh 60 -> minX = 100, width = 30 + 60 = 90
    expect(broadphase.x).toBe(100);
    expect(broadphase.width).toBe(90);

    // Y bergerak dari 100 ke atas sejauh 30 -> minY = 70, height = 30 + 30 = 60
    expect(broadphase.y).toBe(70);
    expect(broadphase.height).toBe(60);
  });

  it('harus mendukung penampung result out buffer untuk performa zero-allocation', () => {
    const player = new AABB(0, 0, 10, 10);
    const obstacle = new AABB(20, 0, 10, 10);
    const scratchResult: SweptResult = { time: 0, normalX: 0, normalY: 0 };

    const res = sweptAABB(player, 100, 0, 1.0, obstacle, scratchResult);
    expect(res).toBe(scratchResult);
    expect(scratchResult.time).toBeCloseTo(0.1, 4);
  });
});
