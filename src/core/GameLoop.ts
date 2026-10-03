export interface GameLoopCallbacks {
  /**
   * Dipanggil pada interval waktu konstan (default: 60Hz / 16.66ms).
   * Digunakan untuk simulasi fisika, kalkulasi posisi, dan state.
   */
  update: (fixedDt: number) => void;

  /**
   * Dipanggil setiap kali browser siap merender frame (via requestAnimationFrame).
   * @param alpha Nilai interpolasi [0, 1] antara tick fisika sebelumnya dan saat ini.
   */
  render: (alpha: number) => void;
}

export interface GameLoopOptions {
  /** Target tick rate simulasi per detik (default: 60). */
  targetUps?: number;
  /** Batas atas delta time per frame dalam detik untuk mencegah spiral of death (default: 0.25). */
  maxFrameTime?: number;
}

/**
 * GameLoop mengimplementasikan Fixed Timestep dengan Render Interpolation.
 * Memisahkan kecepatan tick logika (deterministik) dari frame rate render browser.
 */
export class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private rafId: number | null = null;

  public readonly fixedDt: number;
  public readonly maxFrameTime: number;

  private readonly updateFn: (fixedDt: number) => void;
  private readonly renderFn: (alpha: number) => void;

  // Metrik diagnostik
  private frameCount: number = 0;
  private tickCount: number = 0;
  private lastMetricTime: number = 0;
  public fps: number = 0;
  public ups: number = 0;

  /**
   * Menginisialisasi instance GameLoop baru.
   * @param callbacks Fungsi callback update dan render
   * @param options Opsi konfigurasi frame rate dan batas frame time
   */
  constructor(callbacks: GameLoopCallbacks, options?: GameLoopOptions) {
    const targetUps = options?.targetUps ?? 60;
    this.fixedDt = 1 / targetUps;
    this.maxFrameTime = options?.maxFrameTime ?? 0.25;

    this.updateFn = callbacks.update;
    this.renderFn = callbacks.render;
  }

  /**
   * Memulai game loop.
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.lastMetricTime = this.lastTime;
    this.accumulator = 0;
    this.frameCount = 0;
    this.tickCount = 0;

    const loop = (currentTime: number): void => {
      if (!this.isRunning) return;

      this.step(currentTime);
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Menghentikan game loop.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Menjalankan satu langkah timing loop.
   * Fungsi ini dipisahkan agar dapat diuji secara terisolasi tanpa DOM/RAF.
   * @param currentTime Timestamp saat ini dalam milidetik (misal: performance.now()).
   */
  public step(currentTime: number): void {
    // Hitung waktu yang berlalu dalam detik
    let frameTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // ⚠️ EDGE CASE: Jika tab browser tidak aktif (minimized / switch tab),
    // requestAnimationFrame berhenti sementara. Begitu tab aktif lagi, frameTime
    // bisa sangat besar (misal 5 detik). Tanpa clamp, loop akan mengeksekusi
    // ratusan tick fisika sekaligus ("Spiral of Death") yang membekukan browser.
    if (frameTime > this.maxFrameTime) {
      frameTime = this.maxFrameTime;
    }

    this.accumulator += frameTime;

    // Update logika game sebanyak kelipatan fixedDt yang terkumpul
    while (this.accumulator >= this.fixedDt) {
      this.updateFn(this.fixedDt);
      this.tickCount++;
      this.accumulator -= this.fixedDt;
    }

    // Alpha adalah sisa akumulasi dibagi fixedDt, bernilai antara 0.0 sampai 1.0.
    // Contoh: alpha = 0.5 artinya waktu render berada tepat di tengah-tengah dua tick fisika.
    const alpha = this.accumulator / this.fixedDt;
    this.renderFn(alpha);
    this.frameCount++;

    // Hitung metrik FPS dan UPS setiap 1 detik
    if (currentTime - this.lastMetricTime >= 1000) {
      this.fps = this.frameCount;
      this.ups = this.tickCount;
      this.frameCount = 0;
      this.tickCount = 0;
      this.lastMetricTime = currentTime;
    }
  }

  /**
   * Mengembalikan status aktif atau tidaknya loop.
   */
  public get active(): boolean {
    return this.isRunning;
  }
}
