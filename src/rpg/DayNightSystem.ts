import type { Camera2D } from '../render/Camera2D';

export type DayNightPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface DayNightOptions {
  /** Durasi waktu siklus 24 jam game dalam detik dunia nyata (default: 180 detik = 3 menit). */
  cycleDurationSeconds?: number;
  /** Jam awal saat dunia diinisialisasi (0.0 - 24.0, default: 11.0 siang). */
  initialHour?: number;
}

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  intensity?: number;
  color?: string;
}

/**
 * DayNightSystem mensimulasikan siklus siang, sore, malam, dan fajar dinamis
 * serta merender radial lighting pencahayaan lentera obor dan api unggun.
 */
export class DayNightSystem {
  public currentHour: number;
  public cycleDuration: number;
  private animTimer: number = 0;

  constructor(options?: DayNightOptions) {
    this.cycleDuration = options?.cycleDurationSeconds ?? 180;
    this.currentHour = options?.initialHour ?? 11.0;
  }

  /**
   * Memajukan waktu game berdasarkan delta time (dt).
   */
  public update(dt: number): void {
    this.animTimer += dt;
    // Hitung penambahan jam (24 jam per cycleDuration detik)
    const hoursElapsed = (dt / this.cycleDuration) * 24;
    this.currentHour = (this.currentHour + hoursElapsed) % 24;
  }

  /**
   * Mengatur jam dunia secara manual (0.0 - 24.0).
   */
  public setTime(hour: number): void {
    this.currentHour = ((hour % 24) + 24) % 24;
  }

  /**
   * Mendapatkan fase waktu saat ini.
   */
  public getPhase(): DayNightPhase {
    const h = this.currentHour;
    if (h >= 5 && h < 8) return 'dawn';
    if (h >= 8 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'dusk';
    return 'night';
  }

  /**
   * Memformat waktu ke format string jam:menit (HH:MM).
   */
  public getTimeString(): string {
    const totalMinutes = Math.floor(this.currentHour * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Menghitung tingkat kegelapan malam hari (0.0 = terang benderang siang, 0.68 = malam gelap).
   */
  public getAmbientDarkness(): number {
    const h = this.currentHour;

    if (h >= 8 && h <= 16) {
      // Siang hari cerah penuh
      return 0.0;
    } else if (h > 16 && h < 20) {
      // Senja (Dusk) - transisi dari 0.0 ke 0.55
      const factor = (h - 16) / 4;
      return factor * 0.55;
    } else if (h >= 20 || h < 4) {
      // Malam pekat (Night) - puncak kegelapan di tengah malam
      const distFromMidnight = Math.min(Math.abs(h - 24), h); // Jarak ke jam 00:00
      const midnightFactor = 1.0 - distFromMidnight / 4;
      return 0.55 + Math.max(0, midnightFactor) * 0.15; // 0.55 - 0.70
    } else {
      // Fajar (Dawn, 4 - 8) - transisi dari 0.55 ke 0.0
      const factor = (8 - h) / 4;
      return factor * 0.55;
    }
  }

  /**
   * Menghasilkan warna ambient overlay berdasarkan fase waktu dunia.
   */
  /**
   * Menghasilkan warna ambient overlay berdasarkan fase waktu dunia.
   */
  public getAmbientColor(): string {
    const darkness = this.getAmbientDarkness();
    const phase = this.getPhase();

    if (phase === 'dusk') {
      // Nuansa hangat keemasan senja yang lembut dan tidak menyilaukan
      const duskAlpha = (darkness * 0.35).toFixed(2);
      return `rgba(50, 26, 12, ${duskAlpha})`;
    } else if (phase === 'dawn') {
      // Nuansa kuning fajar lembut
      const dawnAlpha = (darkness * 0.40).toFixed(2);
      return `rgba(55, 32, 10, ${dawnAlpha})`;
    } else if (phase === 'night') {
      // Nuansa biru malam pekat (deep midnight navy)
      return `rgba(5, 10, 26, ${darkness.toFixed(2)})`;
    }

    return `rgba(0, 0, 0, 0)`;
  }

  /**
   * Merender lapisan bayangan malam dan memotong radial lighting di sekitar sumber cahaya.
   */
  public renderLighting(
    ctx: CanvasRenderingContext2D,
    cam: Camera2D,
    lights: LightSource[]
  ): void {
    const darkness = this.getAmbientDarkness();
    if (darkness <= 0.04) return; // Tidak perlu render lighting di tengah hari cerah

    const phase = this.getPhase();

    ctx.save();

    // 1. Gambar overlay kegelapan ambient menutupi seluruh layar viewport
    ctx.fillStyle = this.getAmbientColor();
    ctx.fillRect(0, 0, cam.viewportWidth, cam.viewportHeight);

    // 2. Carve out radial lights menggunakan destination-out
    // Pada saat dusk (senja) atau dawn (fajar), matahari masih menyinari langit sehingga tidak melubangi layar secara tajam
    if (phase === 'night') {
      ctx.globalCompositeOperation = 'destination-out';

      for (const light of lights) {
        // Translasi koordinat dunia ke layar (screen space)
        const screenX = light.x - cam.x;
        const screenY = light.y - cam.y;

        // Culling jika sumber cahaya berada di luar layar
        if (
          screenX + light.radius < 0 ||
          screenX - light.radius > cam.viewportWidth ||
          screenY + light.radius < 0 ||
          screenY - light.radius > cam.viewportHeight
        ) {
          continue;
        }

        // Efek flicker api obor/lentera bernafas tenang (2.5 Hz alami, bukan getaran menyilaukan)
        const flicker = Math.sin(this.animTimer * 2.5 + light.x) * 1.5;
        const effectiveRadius = Math.max(10, light.radius + flicker);
        const intensity = light.intensity ?? 0.85;

        const grad = ctx.createRadialGradient(
          screenX,
          screenY,
          effectiveRadius * 0.15,
          screenX,
          screenY,
          effectiveRadius
        );

        grad.addColorStop(0, `rgba(0, 0, 0, ${intensity.toFixed(2)})`);
        grad.addColorStop(0.5, `rgba(0, 0, 0, ${(intensity * 0.5).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, effectiveRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Tambahkan kilau hangat warna obor (warm amber glow) di atas potongan cahaya
    ctx.globalCompositeOperation = 'source-over';
    for (const light of lights) {
      const screenX = light.x - cam.x;
      const screenY = light.y - cam.y;

      if (
        screenX + light.radius < 0 ||
        screenX - light.radius > cam.viewportWidth ||
        screenY + light.radius < 0 ||
        screenY - light.radius > cam.viewportHeight
      ) {
        continue;
      }

      // Pada saat senja (dusk), buat kilau lentera sangat lembut dan menenangkan
      const warmColor =
        phase === 'dusk'
          ? 'rgba(255, 190, 80, 0.07)'
          : (light.color ?? 'rgba(255, 185, 70, 0.12)');
      const flicker = Math.sin(this.animTimer * 2.0 + light.y) * 1.2;
      const glowRadius = Math.max(10, (light.radius + flicker) * 0.65);

      const glowGrad = ctx.createRadialGradient(
        screenX,
        screenY,
        glowRadius * 0.1,
        screenX,
        screenY,
        glowRadius
      );
      glowGrad.addColorStop(0, warmColor);
      glowGrad.addColorStop(1, 'rgba(255, 185, 70, 0)');

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
