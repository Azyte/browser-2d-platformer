export interface SoundSynthesizerOptions {
  enabled?: boolean;
  volume?: number;
  headless?: boolean;
}

/**
 * SoundSynthesizer menghasilkan efek suara (SFX) retro 16-bit secara prosedural
 * menggunakan Web Audio API tanpa membutuhkan file audio eksternal (.mp3/.wav).
 */
export class SoundSynthesizer {
  private audioCtx: AudioContext | null = null;
  public isEnabled: boolean;
  public isMuted: boolean = false;
  public volume: number;
  private readonly headless: boolean;

  constructor(options?: SoundSynthesizerOptions) {
    this.isEnabled = options?.enabled ?? true;
    this.volume = options?.volume ?? 0.35;
    this.headless = options?.headless ?? false;
  }

  /**
   * Menginisialisasi AudioContext saat interaksi pengguna pertama kali (klik/tombol).
   * Mencegah browser memblokir audio policy (Autoplay Policy).
   */
  public initContext(): void {
    if (this.headless || this.audioCtx) return;

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    } catch {
      // Browser tidak mendukung Web Audio API
      this.audioCtx = null;
    }
  }

  /**
   * Menghidupkan atau mematikan suara (Mute / Unmute).
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Mengatur tingkat volume master antara 0.0 sampai 1.0.
   */
  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Memainkan nada sederhana dengan osilator dan gain envelope.
   */
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    freqEnd?: number,
    delay: number = 0
  ): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    this.initContext();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const now = this.audioCtx.currentTime + delay;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Efek tebasan pedang dasar (Basic Attack Slash).
   */
  public playAttack(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    // Sapuan frekuensi cepat dari tinggi ke rendah menyerupai angin bilah pedang
    this.playTone(520, 0.12, 'sawtooth', 90);
  }

  /**
   * Efek pukulan serangan mengenai target (Hit Impact).
   */
  public playHit(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    this.playTone(160, 0.14, 'triangle', 45);
  }

  /**
   * Efek Critical Hit (dentang tajam dan benturan keras).
   */
  public playCrit(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    this.playTone(880, 0.18, 'square', 220);
    this.playTone(220, 0.22, 'sawtooth', 55, 0.04);
  }

  /**
   * Efek jurus Whirlwind Slash (pusaran angin berputar).
   */
  public playWhirlwind(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    this.playTone(320, 0.28, 'sawtooth', 120);
    this.playTone(640, 0.22, 'sine', 280, 0.08);
  }

  /**
   * Efek meminum ramuan (Potion Glug).
   */
  public playPotion(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    this.playTone(340, 0.08, 'sine', 480);
    this.playTone(480, 0.09, 'sine', 620, 0.09);
    this.playTone(620, 0.12, 'sine', 780, 0.18);
  }

  /**
   * Efek kenaikan level (Level Up Fanfare).
   */
  public playLevelUp(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    // Akor arpeggio mayor kemuliaan C - E - G - High C
    this.playTone(523.25, 0.12, 'triangle', undefined, 0.0); // C5
    this.playTone(659.25, 0.12, 'triangle', undefined, 0.1); // E5
    this.playTone(783.99, 0.14, 'triangle', undefined, 0.2); // G5
    this.playTone(1046.5, 0.35, 'square', undefined, 0.32); // C6
  }

  /**
   * Efek penyelesaian misi (Quest Complete Chime).
   */
  public playQuestComplete(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    this.playTone(587.33, 0.14, 'sine', undefined, 0.0); // D5
    this.playTone(880.0, 0.28, 'triangle', undefined, 0.12); // A5
    this.playTone(1174.66, 0.45, 'square', undefined, 0.26); // D6
  }

  /**
   * Efek mengambil barang jarahan (Loot Pickup Coins).
   */
  public playLootPickup(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    this.playTone(987.77, 0.08, 'sine', 1318.51); // B5 ke E6
  }

  /**
   * Efek transaksi toko belanja atau penjualan barang (Shop Transaction Chime).
   */
  public playShopTransaction(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    // Gemerincing koin ganda di meja pedagang
    this.playTone(880.0, 0.09, 'sine', undefined, 0.0);
    this.playTone(1318.51, 0.16, 'triangle', undefined, 0.08);
  }

  /**
   * Nada peringatan jika saldo gold kurang atau tas penuh (Error / Warning Tone).
   */
  public playErrorTone(): void {
    if (this.headless || !this.isEnabled || this.isMuted) return;
    this.playTone(160, 0.18, 'sawtooth', 110);
  }
}

