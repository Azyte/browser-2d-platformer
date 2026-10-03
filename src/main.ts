import { GameLoop } from './core/GameLoop';
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

// ==========================================
// 2. SISTEM LOGIKA & RENDER (Systems)
// ==========================================

/**
 * MovementSystem memproses entitas yang memiliki TransformComponent dan VelocityComponent.
 */
export class MovementSystem implements System {
  constructor(private readonly boundsWidth: number) {}

  public update(world: World, dt: number): void {
    const entities = world.query(TransformComponent, VelocityComponent);

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent);
      const velocity = world.getComponent(entity, VelocityComponent);

      if (!transform || !velocity) continue;

      // Simpan koordinat sebelum kalkulasi baru untuk kebutuhan render interpolation
      transform.prevX = transform.x;
      transform.prevY = transform.y;

      transform.x += velocity.vx * dt;
      transform.y += velocity.vy * dt;

      // Wrap-around horizontal canvas
      if (transform.x > this.boundsWidth) {
        transform.x = -30;
        transform.prevX = transform.x;
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
    <h1 style="margin: 0 0 8px 0; color: #58a6ff; font-size: 20px;">Browser 2D Platformer Engine (ECS + Fixed Timestep)</h1>
    <p style="color: #8b949e; margin: 0 0 16px 0;">Portfolio GDGoC Universitas Gunadarma: Custom Architecture</p>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px;">
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
        <span style="color: #8b949e; font-size: 11px;">Interpolation Alpha</span>
        <div id="alpha-val" style="font-size: 20px; font-weight: bold; color: #bc8cff;">0.00</div>
      </div>
    </div>

    <canvas id="game-canvas" width="640" height="240" style="display: block; border: 1px solid #30363d; background: #030712; border-radius: 6px;"></canvas>
    <p style="font-size: 12px; color: #8b949e; margin-top: 12px;">Visual: Entitas bergerak diupdate deterministik di Fixed Timestep 60Hz dan dirender mulus via Alpha Interpolation.</p>
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

// Inisialisasi ECS World
const world = new World();

// Daftarkan Sistem
world.addSystem(new MovementSystem(canvas.width));
world.addSystem(new RenderSystem(ctx, canvas.width, canvas.height));

// Buat beberapa entitas demo dengan karakteristik berbeda
const demoEntitiesData = [
  { y: 40, vx: 90, color: '#3fb950', label: 'E1: Player (Fast)' },
  { y: 100, vx: 50, color: '#58a6ff', label: 'E2: NPC (Medium)' },
  { y: 160, vx: 30, color: '#f0883e', label: 'E3: Patrol (Slow)' },
  { y: 190, vx: 120, color: '#bc8cff', label: 'E4: Projectile' },
];

for (const data of demoEntitiesData) {
  const entity = world.createEntity();
  world.addComponent(entity, new TransformComponent(10, data.y));
  world.addComponent(entity, new VelocityComponent(data.vx, 0));
  world.addComponent(entity, new RenderableComponent(28, 20, data.color, data.label));
}

// Inisialisasi GameLoop yang menggerakkan World
const loop = new GameLoop({
  update: (fixedDt: number) => {
    world.update(fixedDt);
  },
  render: (alpha: number) => {
    world.render(alpha);

    // Update metrik diagnostik ke UI
    fpsEl.textContent = loop.fps.toString();
    upsEl.textContent = loop.ups.toString();
    entitiesEl.textContent = world.entityCount.toString();
    alphaEl.textContent = alpha.toFixed(3);
  },
});

loop.start();
