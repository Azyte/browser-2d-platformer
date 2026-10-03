export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CameraOptions {
  /** Lebar viewport dalam pixel (biasanya canvas.width). */
  viewportWidth: number;
  /** Tinggi viewport dalam pixel (biasanya canvas.height). */
  viewportHeight: number;
  /** Batas pergerakan kamera di dalam level dunia game. */
  worldBounds?: CameraBounds;
  /** Kecepatan smoothing lerp kamera (0 = diam, 1 = instan tanpa smoothing). Default: 0.1 */
  smoothFactor?: number;
  /** Ukuran deadzone di tengah layar [lebar, tinggi]. Target dapat bergerak di area ini tanpa menggeser kamera. */
  deadzone?: { width: number; height: number };
}

/**
 * Camera2D mengatur translasi viewport dari World Coordinates ke Screen Coordinates.
 * Mendukung target following, smooth lerp damping, deadzone, dan viewport culling.
 */
export class Camera2D {
  public x: number = 0;
  public y: number = 0;

  public viewportWidth: number;
  public viewportHeight: number;

  public smoothFactor: number;
  public worldBounds?: CameraBounds;
  public deadzone?: { width: number; height: number };

  /**
   * Menginisialisasi Camera2D baru.
   * @param options Konfigurasi dimensi viewport, batas dunia, dan smoothing
   */
  constructor(options: CameraOptions) {
    this.viewportWidth = options.viewportWidth;
    this.viewportHeight = options.viewportHeight;
    this.worldBounds = options.worldBounds;
    this.smoothFactor = options.smoothFactor ?? 0.1;
    this.deadzone = options.deadzone;
  }

  /**
   * Mengikuti posisi target di dunia game dengan menerapkan deadzone dan smoothing lerp.
   * @param targetX Posisi X target di dunia game
   * @param targetY Posisi Y target di dunia game
   * @param instant Jika true, kamera langsung meloncat ke target tanpa lerp (misal saat respawn)
   */
  public follow(targetX: number, targetY: number, instant: boolean = false): void {
    // Pusat viewport saat ini
    const centerX = this.x + this.viewportWidth / 2;
    const centerY = this.y + this.viewportHeight / 2;

    let desiredX = this.x;
    let desiredY = this.y;

    if (this.deadzone) {
      // ⚠️ EDGE CASE: Tanpa deadzone, karakter yang berbalik arah atau melangkah 1 pixel
      // akan langsung menggeser kamera, membuat visual berguncang (micro-jitter).
      const halfDeadW = this.deadzone.width / 2;
      const halfDeadH = this.deadzone.height / 2;

      const diffX = targetX - centerX;
      const diffY = targetY - centerY;

      if (Math.abs(diffX) > halfDeadW) {
        desiredX += diffX - Math.sign(diffX) * halfDeadW;
      }
      if (Math.abs(diffY) > halfDeadH) {
        desiredY += diffY - Math.sign(diffY) * halfDeadH;
      }
    } else {
      desiredX = targetX - this.viewportWidth / 2;
      desiredY = targetY - this.viewportHeight / 2;
    }

    if (instant) {
      this.x = desiredX;
      this.y = desiredY;
    } else {
      // Smooth lerp: interpolasi posisi bertahap menuju target
      this.x += (desiredX - this.x) * this.smoothFactor;
      this.y += (desiredY - this.y) * this.smoothFactor;
    }

    // Clamp posisi kamera agar tidak memperlihatkan area di luar batas dunia game
    this.clampToBounds();
  }

  /**
   * Mengonversi koordinat dunia game (World) ke koordinat layar browser (Screen).
   * @param worldX Posisi X di dunia game
   * @param worldY Posisi Y di dunia game
   */
  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.x,
      y: worldY - this.y,
    };
  }

  /**
   * Mengonversi koordinat layar browser (misal klik mouse) ke koordinat dunia game (World).
   * @param screenX Posisi X di canvas layar
   * @param screenY Posisi Y di canvas layar
   */
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX + this.x,
      y: screenY + this.y,
    };
  }

  /**
   * Memeriksa apakah suatu kotak AABB berada di dalam jangkauan viewport kamera saat ini (Viewport Culling).
   * Digunakan untuk melewati proses rendering objek atau tile yang berada di luar layar.
   * @param x Posisi X objek di dunia game
   * @param y Posisi Y objek di dunia game
   * @param width Lebar objek
   * @param height Tinggi objek
   */
  public isVisible(x: number, y: number, width: number, height: number): boolean {
    return (
      x + width >= this.x &&
      x <= this.x + this.viewportWidth &&
      y + height >= this.y &&
      y <= this.y + this.viewportHeight
    );
  }

  /**
   * Membatasi koordinat kamera berdasarkan batas dunia (world bounds) yang ditentukan.
   */
  private clampToBounds(): void {
    if (!this.worldBounds) return;

    // ⚠️ EDGE CASE: Jika ukuran level lebih kecil dari ukuran viewport canvas,
    // kamera harus terkunci di posisi awal dan tidak bergetar (bounce).
    const maxAllowedX = Math.max(this.worldBounds.minX, this.worldBounds.maxX - this.viewportWidth);
    const maxAllowedY = Math.max(this.worldBounds.minY, this.worldBounds.maxY - this.viewportHeight);

    this.x = Math.max(this.worldBounds.minX, Math.min(maxAllowedX, this.x));
    this.y = Math.max(this.worldBounds.minY, Math.min(maxAllowedY, this.y));
  }
}
