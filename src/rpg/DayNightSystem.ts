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
  public isLightingEnabled: boolean = true;
  private animTimer: number = 0;
  private cutoutSprite: HTMLCanvasElement | null = null;
  private glowSprite: HTMLCanvasElement | null = null;

  constructor(options?: DayNightOptions) {
    this.cycleDuration = options?.cycleDurationSeconds ?? 180;
    this.currentHour = options?.initialHour ?? 11.0;
  }

  /**
   * Mengubah status aktif/nonaktif efek pencahayaan dinamis.
   */
  public toggleLighting(): boolean {
    this.isLightingEnabled = !this.isLightingEnabled;
    return this.isLightingEnabled;
  }

  /**
   * Menginisialisasi sprite gradien cahaya radial satu kali ke offscreen canvas.
   * Menghindari alokasi createRadialGradient berulang tiap frame (zero GC overhead, 60 FPS).
   */
  private initLightSprites(): void {
    if (typeof document === 'undefined' || this.cutoutSprite) return;
    try {
      // 1. Sprite radial cutout untuk melubangi kegelapan malam (destination-out)
      const c1 = document.createElement('canvas');
      c1.width = 128;
      c1.height = 128;
      const ctx1 = c1.getContext('2d');
      if (ctx1) {
        const grad1 = ctx1.createRadialGradient(64, 64, 8, 64, 64, 64);
        grad1.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
        grad1.addColorStop(0.5, 'rgba(0, 0, 0, 0.50)');
        grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx1.fillStyle = grad1;
        ctx1.beginPath();
        ctx1.arc(64, 64, 64, 0, Math.PI * 2);
        ctx1.fill();
        this.cutoutSprite = c1;
      }

      // 2. Sprite radial kilau hangat lentera obor (source-over)
      const c2 = document.createElement('canvas');
      c2.width = 128;
      c2.height = 128;
      const ctx2 = c2.getContext('2d');
      if (ctx2) {
        const grad2 = ctx2.createRadialGradient(64, 64, 6, 64, 64, 64);
        grad2.addColorStop(0, 'rgba(255, 185, 70, 0.20)');
        grad2.addColorStop(0.6, 'rgba(255, 185, 70, 0.05)');
        grad2.addColorStop(1, 'rgba(255, 185, 70, 0)');
        ctx2.fillStyle = grad2;
        ctx2.beginPath();
        ctx2.arc(64, 64, 64, 0, Math.PI * 2);
        ctx2.fill();
        this.glowSprite = c2;
      }
    } catch {
      this.cutoutSprite = null;
      this.glowSprite = null;
    }
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
  public getAmbientColor(): string {
    const darkness = this.getAmbientDarkness();
    const phase = this.getPhase();

    if (phase === 'dusk') {
      // Nuansa hangat keemasan senja yang lembut dan tidak menyilaukan
      const duskAlpha = (darkness * 0.22).toFixed(2);
      return `rgba(50, 26, 12, ${duskAlpha})`;
    } else if (phase === 'dawn') {
      // Nuansa kuning fajar lembut
      const dawnAlpha = (darkness * 0.25).toFixed(2);
      return `rgba(55, 32, 10, ${dawnAlpha})`;
    } else if (phase === 'night') {
      // Nuansa biru malam pekat (deep midnight navy)
      const nightAlpha = (darkness * 0.82).toFixed(2);
      return `rgba(5, 10, 26, ${nightAlpha})`;
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
    if (!this.isLightingEnabled) return;

    const darkness = this.getAmbientDarkness();
    if (darkness <= 0.04) return; // Siang hari cerah tidak memerlukan layer pencahayaan

    const phase = this.getPhase();

    ctx.save();

    // 1. Gambar overlay kegelapan ambient warna langit
    ctx.fillStyle = this.getAmbientColor();
    ctx.fillRect(0, 0, cam.viewportWidth, cam.viewportHeight);

    // 2. Pada waktu malam gulita (night), gambar lubang lentera dengan pre-rendered hardware sprites
    // Catatan: Pada waktu dusk (senja) atau dawn (fajar), cukup rona langit alami tanpa lubang kontras
    if (phase === 'night' && lights.length > 0) {
      this.initLightSprites();

      // Potong kegelapan malam dengan sprite cutout
      if (this.cutoutSprite) {
        ctx.globalCompositeOperation = 'destination-out';
        for (const light of lights) {
          const sx = light.x - cam.x;
          const sy = light.y - cam.y;
          const r = light.radius;

          if (
            sx + r < 0 ||
            sx - r > cam.viewportWidth ||
            sy + r < 0 ||
            sy - r > cam.viewportHeight
          ) {
            continue;
          }

          ctx.drawImage(
            this.cutoutSprite,
            Math.round(sx - r),
            Math.round(sy - r),
            Math.round(r * 2),
            Math.round(r * 2)
          );
        }
      }

      // Berikan kilau hangat lentera obor
      if (this.glowSprite) {
        ctx.globalCompositeOperation = 'source-over';
        for (const light of lights) {
          const sx = light.x - cam.x;
          const sy = light.y - cam.y;
          const r = light.radius * 0.75;

          if (
            sx + r < 0 ||
            sx - r > cam.viewportWidth ||
            sy + r < 0 ||
            sy - r > cam.viewportHeight
          ) {
            continue;
          }

          ctx.drawImage(
            this.glowSprite,
            Math.round(sx - r),
            Math.round(sy - r),
            Math.round(r * 2),
            Math.round(r * 2)
          );
        }
      }
    }

    ctx.restore();
  }
}
