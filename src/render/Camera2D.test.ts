import { describe, it, expect } from 'vitest';
import { Camera2D } from './Camera2D';

describe('Camera2D', () => {
  it('harus mengonversi koordinat World ke Screen dan sebaliknya dengan tepat', () => {
    const camera = new Camera2D({ viewportWidth: 640, viewportHeight: 480 });
    camera.x = 200;
    camera.y = 150;

    // Objek di world (500, 300) harus muncul di screen (300, 150)
    const screenPos = camera.worldToScreen(500, 300);
    expect(screenPos.x).toBe(300);
    expect(screenPos.y).toBe(150);

    // Titik screen (300, 150) harus kembali ke world (500, 300)
    const worldPos = camera.screenToWorld(300, 150);
    expect(worldPos.x).toBe(500);
    expect(worldPos.y).toBe(300);
  });

  it('harus menempatkan target tepat di tengah saat follow instan tanpa deadzone', () => {
    const camera = new Camera2D({ viewportWidth: 600, viewportHeight: 400 });

    // Target di (1000, 500)
    // Pusat viewport adalah (x + 300, y + 200). Jadi x = 700, y = 300
    camera.follow(1000, 500, true);

    expect(camera.x).toBe(700);
    expect(camera.y).toBe(300);
  });

  it('harus bergerak bertahap saat follow menggunakan smoothFactor (lerp)', () => {
    const camera = new Camera2D({
      viewportWidth: 600,
      viewportHeight: 400,
      smoothFactor: 0.5,
    });
    camera.x = 0;
    camera.y = 0;

    // Target diinginkan di (300, 200) -> desired camera x=0, y=0
    // Geser target jauh ke (900, 200) -> desired camera x=600
    camera.follow(900, 200, false);

    // Karena smoothFactor 0.5, kamera bergerak setengah jarak: 0 + (600 - 0) * 0.5 = 300
    expect(camera.x).toBe(300);
    expect(camera.y).toBe(0);
  });

  it('tidak boleh menggeser kamera jika target masih berada di dalam area deadzone', () => {
    const camera = new Camera2D({
      viewportWidth: 600,
      viewportHeight: 400,
      deadzone: { width: 100, height: 100 },
    });

    // Posisikan target di pusat viewport awal (300, 200)
    camera.follow(300, 200, true);
    const initialX = camera.x;
    const initialY = camera.y;

    // Geser target sedikit (20 pixel ke kanan), masih di dalam deadzone (half-width = 50px)
    camera.follow(320, 200, true);
    expect(camera.x).toBe(initialX);
    expect(camera.y).toBe(initialY);

    // Geser target keluar dari deadzone (70 pixel ke kanan)
    camera.follow(370, 200, true);
    expect(camera.x).toBeGreaterThan(initialX);
  });

  it('harus membatasi pergerakan kamera agar tidak melewati worldBounds', () => {
    const camera = new Camera2D({
      viewportWidth: 600,
      viewportHeight: 400,
      worldBounds: { minX: 0, minY: 0, maxX: 1200, maxY: 800 },
    });

    // Coba geser kamera jauh ke kiri atas (melebihi batas minX: 0)
    camera.follow(-500, -500, true);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);

    // Coba geser kamera jauh ke kanan bawah (melebihi maxX: 1200 - 600 = 600)
    camera.follow(5000, 5000, true);
    expect(camera.x).toBe(600);
    expect(camera.y).toBe(400);
  });

  it('harus mendeteksi visibilitas objek di dalam viewport (viewport culling)', () => {
    const camera = new Camera2D({ viewportWidth: 640, viewportHeight: 480 });
    camera.x = 100;
    camera.y = 100;

    // Objek di dalam layar (x: 200, y: 200, w: 32, h: 32)
    expect(camera.isVisible(200, 200, 32, 32)).toBe(true);

    // Objek di luar layar sebelah kiri (x: 10, y: 150)
    expect(camera.isVisible(10, 150, 32, 32)).toBe(false);

    // Objek di luar layar sebelah kanan (x: 800, y: 150)
    expect(camera.isVisible(800, 150, 32, 32)).toBe(false);
  });
});
