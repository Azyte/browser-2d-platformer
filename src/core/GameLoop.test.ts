import { describe, it, expect, vi } from 'vitest';
import { GameLoop } from './GameLoop';

describe('GameLoop (Fixed Timestep)', () => {
  it('harus memanggil update sesuai kelipatan fixedDt', () => {
    const updateFn = vi.fn();
    const renderFn = vi.fn();

    // 60 UPS -> fixedDt = 1/60s = ~16.666ms
    const loop = new GameLoop({ update: updateFn, render: renderFn }, { targetUps: 60 });

    // Step pertama: inisialisasi baseline waktu pada 0ms
    loop.step(0);
    expect(updateFn).toHaveBeenCalledTimes(0);

    // Step kedua: maju 50ms (harus memicu tepat 3 ticks: 16.66ms * 3 = ~50ms)
    loop.step(50);
    expect(updateFn).toHaveBeenCalledTimes(3);
    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('harus melakukan clamp frameTime saat terjadi lag besar (Spiral of Death Protection)', () => {
    const updateFn = vi.fn();
    const renderFn = vi.fn();

    // maxFrameTime diset ke 0.1 detik (100ms)
    const loop = new GameLoop(
      { update: updateFn, render: renderFn },
      { targetUps: 60, maxFrameTime: 0.1 }
    );

    loop.step(0);

    // Simulasi lag ekstrim: 2000ms (2 detik)
    loop.step(2000);

    // Tanpa clamp, update akan dipanggil 120x (2 detik * 60).
    // Karena di-clamp ke 100ms, update hanya dipanggil 6x (100ms / 16.66ms = 6).
    expect(updateFn).toHaveBeenCalledTimes(6);
  });

  it('harus menghitung nilai alpha interpolasi secara presisi', () => {
    let capturedAlpha = 0;
    const loop = new GameLoop(
      {
        update: () => {},
        render: (alpha) => {
          capturedAlpha = alpha;
        },
      },
      { targetUps: 100 } // fixedDt = 10ms
    );

    loop.step(0);
    // Maju 15ms: 10ms untuk 1 update, sisa 5ms di accumulator.
    // Alpha harus bernilai 5ms / 10ms = 0.5.
    loop.step(15);

    expect(capturedAlpha).toBeCloseTo(0.5, 2);
  });
});
