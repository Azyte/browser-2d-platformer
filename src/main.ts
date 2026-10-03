import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { World } from './ecs/World';
import { Camera2D } from './render/Camera2D';
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
    public width: number = 28,
    public height: number = 28,
    public color: string = '#00ffcc',
    public label: string = ''
  ) {}
}

export class PlayerControlledComponent {
  constructor(public moveSpeed: number = 220) {}
}

// ==========================================
// 2. SISTEM LOGIKA, KAMERA & RENDER
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

      // Normalisasi vektor diagonal
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
 * MovementSystem memproses pergerakan dan membatasi pemain di dalam batas dunia game (World Bounds).
 */
export class MovementSystem implements System {
  constructor(private readonly worldWidth: number, private readonly worldHeight: number) {}

  public update(world: World, dt: number): void {
    const entities = world.query(TransformComponent, VelocityComponent);

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent);
      const velocity = world.getComponent(entity, VelocityComponent);
      const isPlayer = world.hasComponent(entity, PlayerControlledComponent);

      if (!transform || !velocity) continue;

      transform.prevX = transform.x;
      transform.prevY = transform.y;

      transform.x += velocity.vx * dt;
      transform.y += velocity.vy * dt;

      if (isPlayer) {
        transform.x = Math.max(0, Math.min(this.worldWidth - 28, transform.x));
        transform.y = Math.max(0, Math.min(this.worldHeight - 28, transform.y));
      } else {
        // Objek NPC berpatroli bolak-balik
        if (transform.x <= 0 || transform.x >= this.worldWidth - 28) {
          velocity.vx = -velocity.vx;
        }
      }
    }
  }
}

/**
 * CameraFollowSystem menggerakkan kamera untuk mengikuti posisi entitas pemain secara halus (lerp).
 */
export class CameraFollowSystem implements System {
  constructor(private readonly camera: Camera2D) {}

  public update(world: World): void {
    const players = world.query(TransformComponent, PlayerControlledComponent);
    if (players.length === 0) return;

    const transform = world.getComponent(players[0], TransformComponent);
    if (transform) {
      // Kamera mengarahkan fokus ke titik tengah pemain
      this.camera.follow(transform.x + 14, transform.y + 14);
    }
  }
}

/**
 * RenderSystem merender background grid, batas dunia, dan entitas yang terlihat (Viewport Culling).
 */
export class RenderSystem implements System {
  public visibleEntitiesCount: number = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly camera: Camera2D,
    private readonly worldWidth: number,
    private readonly worldHeight: number
  ) {}

  public render(world: World, alpha: number): void {
    const ctx = this.ctx;
    const cam = this.camera;

    // Bersihkan layar canvas
    ctx.clearRect(0, 0, cam.viewportWidth, cam.viewportHeight);

    // Simpan transform canvas asli sebelum translasi kamera
    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    // 1. Gambar latar belakang Grid dunia (dengan culling vertikal/horizontal)
    ctx.strokeStyle = '#1e2633';
    ctx.lineWidth = 1;
    const gridSize = 60;

    const startX = Math.floor(cam.x / gridSize) * gridSize;
    const endX = Math.min(this.worldWidth, cam.x + cam.viewportWidth + gridSize);
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.worldHeight);
      ctx.stroke();

      // Penanda meter/koordinat
      ctx.fillStyle = '#485263';
      ctx.font = '10px monospace';
      ctx.fillText(`${x}px`, x + 4, 14);
    }

    // 2. Gambar batas terluar level dunia
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

    // 3. Render entitas dengan Viewport Culling
    this.visibleEntitiesCount = 0;
    const entities = world.query(TransformComponent, RenderableComponent);

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent);
      const renderable = world.getComponent(entity, RenderableComponent);

      if (!transform || !renderable) continue;

      // Hitung koordinat terinterpolasi
      const renderX = transform.prevX + (transform.x - transform.prevX) * alpha;
      const renderY = transform.prevY + (transform.y - transform.prevY) * alpha;

      // Viewport Culling: lewati entitas yang tidak terlihat di layar kamera
      if (!cam.isVisible(renderX, renderY, renderable.width, renderable.height)) {
        continue;
      }

      this.visibleEntitiesCount++;

      // Gambar kotak entitas
      ctx.fillStyle = renderable.color;
      ctx.fillRect(renderX, renderY, renderable.width, renderable.height);

      if (renderable.label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.fillText(renderable.label, renderX, renderY - 4);
      }
    }

    // Kembalikan konteks canvas ke orientasi layar
    ctx.restore();
  }
}

// ==========================================
// 3. BOOTSTRAP ENGINE
// ==========================================

const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 300;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 300;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Elemen #app tidak ditemukan');

app.innerHTML = `
  <div style="font-family: monospace; padding: 24px; background: #0d0f12; color: #e6edf3; min-height: 100vh; box-sizing: border-box;">
    <h1 style="margin: 0 0 6px 0; color: #58a6ff; font-size: 20px;">Browser 2D Platformer Engine (Camera2D + Viewport Culling)</h1>
    <p style="color: #8b949e; margin: 0 0 16px 0;">Portfolio GDGoC Universitas Gunadarma: Custom Architecture</p>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px;">
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">FPS / UPS</span>
        <div style="font-size: 18px; font-weight: bold;"><span id="fps-val" style="color: #3fb950;">0</span> / <span id="ups-val" style="color: #58a6ff;">0</span></div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Visible / Total Entities</span>
        <div style="font-size: 18px; font-weight: bold;"><span id="visible-val" style="color: #bc8cff;">0</span> / <span id="total-val" style="color: #d29922;">0</span></div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Camera Pos (X, Y)</span>
        <div id="cam-val" style="font-size: 16px; font-weight: bold; color: #79c0ff;">0, 0</div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Player World Pos</span>
        <div id="player-val" style="font-size: 16px; font-weight: bold; color: #3fb950;">0, 0</div>
      </div>
    </div>

    <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d; margin-bottom: 14px; font-size: 12px;">
      Gunakan <strong style="color: #79c0ff;">W A S D</strong> atau <strong style="color: #79c0ff;">Tombol Panah</strong> untuk menggerakkan Player di dunia seluas 1800px.
      Kamera otomatis mengikuti dengan smooth lerp damping dan clamping batas dunia.
    </div>

    <canvas id="game-canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" style="display: block; border: 1px solid #30363d; background: #040810; border-radius: 6px;"></canvas>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Canvas element not found');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context not supported');

const fpsEl = document.querySelector<HTMLSpanElement>('#fps-val')!;
const upsEl = document.querySelector<HTMLSpanElement>('#ups-val')!;
const visibleEl = document.querySelector<HTMLSpanElement>('#visible-val')!;
const totalEl = document.querySelector<HTMLSpanElement>('#total-val')!;
const camEl = document.querySelector<HTMLDivElement>('#cam-val')!;
const playerEl = document.querySelector<HTMLDivElement>('#player-val')!;

// Inisialisasi InputManager
const input = new InputManager();

// Inisialisasi Camera2D dengan batas dunia (world bounds)
const camera = new Camera2D({
  viewportWidth: CANVAS_WIDTH,
  viewportHeight: CANVAS_HEIGHT,
  worldBounds: { minX: 0, minY: 0, maxX: WORLD_WIDTH, maxY: WORLD_HEIGHT },
  smoothFactor: 0.08,
  deadzone: { width: 80, height: 60 },
});

// Inisialisasi ECS World
const world = new World();

// Daftarkan Sistem
const renderSystem = new RenderSystem(ctx, camera, WORLD_WIDTH, WORLD_HEIGHT);
world.addSystem(new PlayerInputSystem(input));
world.addSystem(new MovementSystem(WORLD_WIDTH, WORLD_HEIGHT));
world.addSystem(new CameraFollowSystem(camera));
world.addSystem(renderSystem);

// Buat Entitas Pemain
const player = world.createEntity();
world.addComponent(player, new TransformComponent(100, 140));
world.addComponent(player, new VelocityComponent(0, 0));
world.addComponent(player, new RenderableComponent(32, 32, '#3fb950', 'PLAYER'));
world.addComponent(player, new PlayerControlledComponent(240));

// Buat 10 entitas NPC dan obor di sepanjang dunia 1800px untuk menguji Viewport Culling
for (let i = 1; i <= 10; i++) {
  const npc = world.createEntity();
  const posX = i * 160;
  world.addComponent(npc, new TransformComponent(posX, 140 + (i % 2 === 0 ? 40 : -40)));
  world.addComponent(npc, new VelocityComponent(i % 2 === 0 ? 40 : -40, 0));
  world.addComponent(npc, new RenderableComponent(24, 24, i % 2 === 0 ? '#58a6ff' : '#f0883e', `NPC-${i}`));
}

// Inisialisasi GameLoop
const loop = new GameLoop({
  update: (fixedDt: number) => {
    world.update(fixedDt);
    input.endFrame();
  },
  render: (alpha: number) => {
    world.render(alpha);

    // Update metrik ke HUD
    fpsEl.textContent = loop.fps.toString();
    upsEl.textContent = loop.ups.toString();
    visibleEl.textContent = renderSystem.visibleEntitiesCount.toString();
    totalEl.textContent = world.entityCount.toString();
    camEl.textContent = `${Math.round(camera.x)}, ${Math.round(camera.y)}`;

    const playerTransform = world.getComponent(player, TransformComponent);
    if (playerTransform) {
      playerEl.textContent = `${Math.round(playerTransform.x)}, ${Math.round(playerTransform.y)}`;
    }
  },
});

loop.start();
