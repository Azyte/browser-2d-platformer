import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { World } from './ecs/World';
import type { System } from './ecs/System';

// ==========================================
// 1. KOMPONEN DATA (Pure Data Containers)
// ==========================================

export class TransformComponent {
  public prevX: number;
  public prevY: number;

  constructor(public x: number = 0, public y: number = 0) {
    this.prevX = x;
    this.prevY = y;
  }
}

export class VelocityComponent {
  constructor(public vx: number = 0, public vy: number = 0) {}
}

export class RenderableComponent {
  constructor(
    public width: number = 24,
    public height: number = 24,
    public color: string = '#00ffcc',
    public label: string = ''
  ) {}
}

/**
 * Tag component untuk menandai entitas yang dikendalikan oleh pemain melalui input.
 */
export class PlayerControlledComponent {
  constructor(public moveSpeed: number = 180) {}
}

// ==========================================
// 2. SISTEM LOGIKA & RENDER (Systems)
// ==========================================

/**
 * PlayerInputSystem membaca state InputManager dan mengubah Velocity entitas pemain.
 */
export class PlayerInputSystem implements System {
  constructor(private readonly input: InputManager) {}

  public update(world: World): void {
    const players = world.query(TransformComponent, VelocityComponent, PlayerControlledComponent);

    for (const entity of players) {
      const velocity = world.getComponent(entity, VelocityComponent);
      const control = world.getComponent(entity, PlayerControlledComponent);

      if (!velocity || !control) continue;

      let moveX = 0;
      let moveY = 0;

      if (this.input.isActionDown('left')) moveX -= 1;
      if (this.input.isActionDown('right')) moveX += 1;
      if (this.input.isActionDown('up')) moveY -= 1;
      if (this.input.isActionDown('down')) moveY += 1;

      // Normalisasi pergerakan diagonal agar kecepatan tetap konsisten
      if (moveX !== 0 && moveY !== 0) {
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= length;
        moveY /= length;
      }

      velocity.vx = moveX * control.moveSpeed;
      velocity.vy = moveY * control.moveSpeed;
    }
  }
}

/**
 * MovementSystem memproses entitas yang memiliki TransformComponent dan VelocityComponent.
 */
export class MovementSystem implements System {
  constructor(private readonly boundsWidth: number, private readonly boundsHeight: number) {}

  public update(world: World, dt: number): void {
    const entities = world.query(TransformComponent, VelocityComponent);

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent);
      const velocity = world.getComponent(entity, VelocityComponent);
      const isPlayer = world.hasComponent(entity, PlayerControlledComponent);

      if (!transform || !velocity) continue;

      // Simpan koordinat sebelum kalkulasi baru untuk kebutuhan render interpolation
      transform.prevX = transform.x;
      transform.prevY = transform.y;

      transform.x += velocity.vx * dt;
      transform.y += velocity.vy * dt;

      if (isPlayer) {
        // Clamp posisi pemain agar tidak keluar dari area canvas
        transform.x = Math.max(0, Math.min(this.boundsWidth - 28, transform.x));
        transform.y = Math.max(0, Math.min(this.boundsHeight - 28, transform.y));
      } else {
        // Wrap-around horizontal untuk entitas AI / dekorasi
        if (transform.x > this.boundsWidth) {
          transform.x = -30;
          transform.prevX = transform.x;
        }
      }
    }
  }
}

/**
 * RenderSystem membaca posisi terinterpolasi dan menggambar entitas ke Canvas 2D.
 */
export class RenderSystem implements System {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly width: number,
    private readonly height: number
  ) {}

  public render(world: World, alpha: number): void {
    this.ctx.clearRect(0, 0, this.width, this.height);

    const entities = world.query(TransformComponent, RenderableComponent);

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent);
      const renderable = world.getComponent(entity, RenderableComponent);

      if (!transform || !renderable) continue;

      // Hitung koordinat terinterpolasi berdasarkan alpha sisa fixed timestep
      const renderX = transform.prevX + (transform.x - transform.prevX) * alpha;
      const renderY = transform.prevY + (transform.y - transform.prevY) * alpha;

      this.ctx.fillStyle = renderable.color;
      this.ctx.fillRect(renderX, renderY, renderable.width, renderable.height);

      if (renderable.label) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px monospace';
        this.ctx.fillText(renderable.label, renderX, renderY - 4);
      }
    }
  }
}

// ==========================================
// 3. BOOTSTRAP ENGINE & SCENE
// ==========================================

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Elemen #app tidak ditemukan');

app.innerHTML = `
  <div style="font-family: monospace; padding: 24px; background: #0d0f12; color: #e6edf3; min-height: 100vh; box-sizing: border-box;">
    <h1 style="margin: 0 0 8px 0; color: #58a6ff; font-size: 20px;">Browser 2D Platformer Engine (ECS + Fixed Timestep + InputManager)</h1>
    <p style="color: #8b949e; margin: 0 0 16px 0;">Portfolio GDGoC Universitas Gunadarma: Custom Architecture</p>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 16px;">
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">FPS (Render)</span>
        <div id="fps-val" style="font-size: 20px; font-weight: bold; color: #3fb950;">0</div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">UPS (Logic)</span>
        <div id="ups-val" style="font-size: 20px; font-weight: bold; color: #58a6ff;">0</div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Active Entities</span>
        <div id="entities-val" style="font-size: 20px; font-weight: bold; color: #d29922;">0</div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Alpha</span>
        <div id="alpha-val" style="font-size: 20px; font-weight: bold; color: #bc8cff;">0.00</div>
      </div>
    </div>

    <div style="background: #161b22; padding: 12px 16px; border-radius: 6px; border: 1px solid #30363d; margin-bottom: 16px; font-size: 12px;">
      <span style="color: #58a6ff; font-weight: bold;">Kontrol Keyboard:</span>
      Gunakan <span style="color: #79c0ff; font-weight: bold;">W A S D</span> atau <span style="color: #79c0ff; font-weight: bold;">Tombol Panah</span> untuk menggerakkan kotak hijau (Player).
      <div id="input-status" style="margin-top: 8px; color: #8b949e;">Status Aksi: None</div>
    </div>

    <canvas id="game-canvas" width="640" height="260" style="display: block; border: 1px solid #30363d; background: #030712; border-radius: 6px;"></canvas>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Canvas element not found');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context not supported');

const fpsEl = document.querySelector<HTMLSpanElement>('#fps-val')!;
const upsEl = document.querySelector<HTMLSpanElement>('#ups-val')!;
const entitiesEl = document.querySelector<HTMLSpanElement>('#entities-val')!;
const alphaEl = document.querySelector<HTMLSpanElement>('#alpha-val')!;
const inputStatusEl = document.querySelector<HTMLDivElement>('#input-status')!;

// Inisialisasi InputManager
const input = new InputManager();

// Inisialisasi ECS World
const world = new World();

// Daftarkan Sistem dengan urutan yang tepat: Input -> Movement -> Render
world.addSystem(new PlayerInputSystem(input));
world.addSystem(new MovementSystem(canvas.width, canvas.height));
world.addSystem(new RenderSystem(ctx, canvas.width, canvas.height));

// 1. Buat Entitas Player yang dapat dikontrol
const player = world.createEntity();
world.addComponent(player, new TransformComponent(100, 100));
world.addComponent(player, new VelocityComponent(0, 0));
world.addComponent(player, new RenderableComponent(28, 28, '#3fb950', 'PLAYER'));
world.addComponent(player, new PlayerControlledComponent(180));

// 2. Buat beberapa Entitas NPC otomatis sebagai pembanding
const npcEntities = [
  { y: 40, vx: 60, color: '#58a6ff', label: 'NPC-1' },
  { y: 200, vx: 100, color: '#f0883e', label: 'NPC-2' },
];

for (const npc of npcEntities) {
  const entity = world.createEntity();
  world.addComponent(entity, new TransformComponent(20, npc.y));
  world.addComponent(entity, new VelocityComponent(npc.vx, 0));
  world.addComponent(entity, new RenderableComponent(24, 24, npc.color, npc.label));
}

// Inisialisasi GameLoop
const loop = new GameLoop({
  update: (fixedDt: number) => {
    world.update(fixedDt);

    // Bersihkan state one-frame (justPressed / justReleased) pada akhir fixed tick
    input.endFrame();
  },
  render: (alpha: number) => {
    world.render(alpha);

    // Update metrik diagnostik ke UI
    fpsEl.textContent = loop.fps.toString();
    upsEl.textContent = loop.ups.toString();
    entitiesEl.textContent = world.entityCount.toString();
    alphaEl.textContent = alpha.toFixed(3);

    // Tampilkan aksi tombol aktif
    const activeActions: string[] = [];
    if (input.isActionDown('left')) activeActions.push('LEFT');
    if (input.isActionDown('right')) activeActions.push('RIGHT');
    if (input.isActionDown('up')) activeActions.push('UP');
    if (input.isActionDown('down')) activeActions.push('DOWN');
    if (input.isActionDown('jump')) activeActions.push('JUMP');

    inputStatusEl.innerHTML = activeActions.length > 0
      ? `Aksi Aktif: <strong style="color: #3fb950;">${activeActions.join(', ')}</strong>`
      : 'Aksi Aktif: <span style="color: #8b949e;">Idle</span>';
  },
});

loop.start();
