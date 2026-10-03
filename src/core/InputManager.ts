/**
 * Action yang dipetakan dari tombol keyboard fisik ke aksi gameplay logis.
 */
export type InputAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'attack'
  | 'skill'
  | 'potionHp'
  | 'potionMp';

export interface InputManagerOptions {
  /** Elemen target penangkap event keyboard (default: window). */
  target?: Window | HTMLElement;
  /** Pemetaan kustom antara nama action dan kode tombol keyboard (event.code). */
  actionBindings?: Partial<Record<InputAction, string[]>>;
  /** Mencegah scroll halaman saat tombol game (misal: panah, spasi) ditekan. */
  preventDefaults?: boolean;
}

const DEFAULT_BINDINGS: Record<InputAction, string[]> = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  attack: ['Space', 'KeyJ'],
  skill: ['KeyK', 'Digit1', 'Numpad1'],
  potionHp: ['KeyQ'],
  potionMp: ['KeyE'],
};

/**
 * InputManager menangani input keyboard secara deterministik untuk game loop.
 * Menyediakan state tombol: ditekan (isDown), baru ditekan (isJustPressed), dan baru dilepas (isJustReleased).
 */
export class InputManager {
  private readonly target: Window | HTMLElement;
  private readonly bindings: Record<InputAction, string[]>;
  private readonly preventDefaults: boolean;

  // State pelacakan tombol mentah (event.code)
  private readonly activeKeys: Set<string> = new Set();
  private readonly justPressedKeys: Set<string> = new Set();
  private readonly justReleasedKeys: Set<string> = new Set();

  private isListening: boolean = false;

  private readonly handleKeyDown: (event: KeyboardEvent) => void;
  private readonly handleKeyUp: (event: KeyboardEvent) => void;
  private readonly handleBlur: () => void;

  /**
   * Menginisialisasi instance InputManager baru.
   * @param options Opsi konfigurasi target dan key bindings
   */
  constructor(options?: InputManagerOptions) {
    this.target = options?.target ?? window;
    this.preventDefaults = options?.preventDefaults ?? true;

    this.bindings = {
      left: options?.actionBindings?.left ?? DEFAULT_BINDINGS.left,
      right: options?.actionBindings?.right ?? DEFAULT_BINDINGS.right,
      up: options?.actionBindings?.up ?? DEFAULT_BINDINGS.up,
      down: options?.actionBindings?.down ?? DEFAULT_BINDINGS.down,
      jump: options?.actionBindings?.jump ?? DEFAULT_BINDINGS.jump,
      attack: options?.actionBindings?.attack ?? DEFAULT_BINDINGS.attack,
      skill: options?.actionBindings?.skill ?? DEFAULT_BINDINGS.skill,
      potionHp: options?.actionBindings?.potionHp ?? DEFAULT_BINDINGS.potionHp,
      potionMp: options?.actionBindings?.potionMp ?? DEFAULT_BINDINGS.potionMp,
    };

    this.handleKeyDown = (event: KeyboardEvent): void => {
      // ⚠️ EDGE CASE: Browser mengirimkan event keydown berulang jika tombol ditahan terus (event.repeat).
      // Jangan masukkan ke justPressedKeys jika ini adalah event repeat agar aksi instan (seperti lompat) tidak terpanggil berkali-kali.
      if (event.repeat) return;

      const code = event.code;
      if (!this.activeKeys.has(code)) {
        this.justPressedKeys.add(code);
      }
      this.activeKeys.add(code);

      // ⚠️ EDGE CASE: Mencegah tombol panah dan spasi menggulir (scroll) halaman browser
      if (this.preventDefaults && this.isGameKey(code)) {
        event.preventDefault();
      }
    };

    this.handleKeyUp = (event: KeyboardEvent): void => {
      const code = event.code;
      this.activeKeys.delete(code);
      this.justReleasedKeys.add(code);

      if (this.preventDefaults && this.isGameKey(code)) {
        event.preventDefault();
      }
    };

    this.handleBlur = (): void => {
      // ⚠️ EDGE CASE: Pemain menahan tombol lalu switch tab (Alt+Tab / minimize window).
      // Browser tidak akan pernah mengirimkan event keyup ke tab ini.
      // Begitu tab dibuka lagi, karakter akan terus bergerak tanpa henti jika state tidak di-reset.
      this.reset();
    };

    this.startListening();
  }

  /**
   * Mulai mendengarkan event keyboard dari target.
   */
  public startListening(): void {
    if (this.isListening) return;

    this.target.addEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.addEventListener('keyup', this.handleKeyUp as EventListener);
    window.addEventListener('blur', this.handleBlur);
    this.isListening = true;
  }

  /**
   * Berhenti mendengarkan event keyboard dan bersihkan listener.
   */
  public stopListening(): void {
    if (!this.isListening) return;

    this.target.removeEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.handleKeyUp as EventListener);
    window.removeEventListener('blur', this.handleBlur);
    this.reset();
    this.isListening = false;
  }

  /**
   * Dipanggil pada akhir setiap frame / fixed tick untuk membersihkan state one-frame (justPressed & justReleased).
   */
  public endFrame(): void {
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
  }

  /**
   * Mereset seluruh state input yang sedang aktif.
   */
  public reset(): void {
    this.activeKeys.clear();
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
  }

  /**
   * Mengatur state aksi secara programmatic (misal dari D-pad sentuh virtual / tombol sentuh mobile).
   */
  public setVirtualAction(action: InputAction, isDown: boolean): void {
    const keys = this.bindings[action];
    if (!keys || keys.length === 0) return;
    const primaryKey = keys[0];

    if (isDown) {
      if (!this.activeKeys.has(primaryKey)) {
        this.justPressedKeys.add(primaryKey);
      }
      this.activeKeys.add(primaryKey);
    } else {
      if (this.activeKeys.has(primaryKey)) {
        this.activeKeys.delete(primaryKey);
        this.justReleasedKeys.add(primaryKey);
      }
    }
  }

  /**
   * Memeriksa apakah suatu aksi sedang ditahan (held down).
   * @param action Nama aksi gameplay (misal: 'left', 'jump')
   */
  public isActionDown(action: InputAction): boolean {
    const keys = this.bindings[action];
    for (const key of keys) {
      if (this.activeKeys.has(key)) return true;
    }
    return false;
  }

  /**
   * Memeriksa apakah suatu aksi baru saja ditekan pada tick saat ini.
   * Sangat berguna untuk trigger aksi sekali jalan seperti lompat atau serang.
   * @param action Nama aksi gameplay
   */
  public isActionJustPressed(action: InputAction): boolean {
    const keys = this.bindings[action];
    for (const key of keys) {
      if (this.justPressedKeys.has(key)) return true;
    }
    return false;
  }

  /**
   * Memeriksa apakah suatu aksi baru saja dilepas pada tick saat ini.
   * Berguna untuk mekanik variable jump height (melepas tombol lompat lebih awal untuk lompatan pendek).
   * @param action Nama aksi gameplay
   */
  public isActionJustReleased(action: InputAction): boolean {
    const keys = this.bindings[action];
    for (const key of keys) {
      if (this.justReleasedKeys.has(key)) return true;
    }
    return false;
  }

  /**
   * Memeriksa apakah suatu tombol keyboard tertentu (event.code) sedang aktif.
   * @param code Kode tombol keyboard (misal: 'Space', 'ArrowRight')
   */
  public isKeyDown(code: string): boolean {
    return this.activeKeys.has(code);
  }

  /**
   * Memeriksa apakah kode tombol terdaftar dalam game action.
   */
  private isGameKey(code: string): boolean {
    for (const keys of Object.values(this.bindings)) {
      if (keys.includes(code)) return true;
    }
    return false;
  }
}
