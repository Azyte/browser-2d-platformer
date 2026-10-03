import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { World } from './ecs/World';
import { Camera2D } from './render/Camera2D';
import type { System } from './ecs/System';
import { TransformComponent } from './physics/TransformComponent';
import { VelocityComponent } from './physics/VelocityComponent';
import {
  ColliderComponent,
  RigidBodyComponent,
  SolidObstacleComponent,
} from './physics/PhysicsComponents';
import { PhysicsSystem } from './physics/PhysicsSystem';
import { PlatformerControllerComponent } from './physics/PlatformerControllerComponent';
import { PlatformerControllerSystem } from './physics/PlatformerControllerSystem';

// ==========================================
// 1. KOMPONEN VISUAL
// ==========================================

export class RenderableComponent {
  constructor(
    public width: number = 28,
    public height: number = 28,
    public color: string = '#00ffcc',
    public label: string = ''
  ) {}
}

// ==========================================
// 2. SISTEM KAMERA & RENDER
// ==========================================

/**
 * CameraFollowSystem menggerakkan kamera untuk mengikuti posisi entitas pemain secara halus (lerp).
 */
export class CameraFollowSystem implements System {
  constructor(private readonly camera: Camera2D) {}

  public update(world: World): void {
    const players = world.query(TransformComponent, PlatformerControllerComponent);
    if (players.length === 0) return;

    const transform = world.getComponent(players[0], TransformComponent);
    if (transform) {
      this.camera.follow(transform.x + 14, transform.y + 14);
    }
  }
}

/**
 * RenderSystem merender background grid, lantai/platform solid, dan entitas dengan Viewport Culling.
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

    ctx.clearRect(0, 0, cam.viewportWidth, cam.viewportHeight);

    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    // 1. Grid dunia
    ctx.strokeStyle = '#1a2230';
    ctx.lineWidth = 1;
    const gridSize = 60;
    const startX = Math.floor(cam.x / gridSize) * gridSize;
    const endX = Math.min(this.worldWidth, cam.x + cam.viewportWidth + gridSize);

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.worldHeight);
      ctx.stroke();

      ctx.fillStyle = '#3a4659';
      ctx.font = '10px monospace';
      ctx.fillText(`${x}px`, x + 4, 14);
    }

    // 2. Batas dunia (merah)
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

    // 3. Render entitas dengan Viewport Culling
    this.visibleEntitiesCount = 0;
    const entities = world.query(TransformComponent, RenderableComponent);

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent);
      const renderable = world.getComponent(entity, RenderableComponent);
      const isSolid = world.hasComponent(entity, SolidObstacleComponent);

      if (!transform || !renderable) continue;

      const renderX = transform.prevX + (transform.x - transform.prevX) * alpha;
      const renderY = transform.prevY + (transform.y - transform.prevY) * alpha;

      // Viewport culling
      if (!cam.isVisible(renderX, renderY, renderable.width, renderable.height)) {
        continue;
      }

      this.visibleEntitiesCount++;

      ctx.fillStyle = renderable.color;
      ctx.fillRect(renderX, renderY, renderable.width, renderable.height);

      if (isSolid) {
        ctx.strokeStyle = '#388bfd';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(renderX, renderY, renderable.width, renderable.height);
      }

      if (renderable.label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.fillText(renderable.label, renderX, renderY - 4);
      }
    }

    ctx.restore();
  }
}

// ==========================================
// 3. BOOTSTRAP ENGINE & LEVEL DESIGN
// ==========================================

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 400;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 320;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Elemen #app tidak ditemukan');

app.innerHTML = `
  <div style="font-family: monospace; padding: 20px; background: #0d0f12; color: #e6edf3; min-height: 100vh; box-sizing: border-box;">
    <h1 style="margin: 0 0 6px 0; color: #58a6ff; font-size: 20px;">Browser 2D Platformer Engine (Kinematic Controller & Game Feel)</h1>
    <p style="color: #8b949e; margin: 0 0 14px 0;">Portfolio GDGoC Universitas Gunadarma: Custom Architecture</p>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 12px;">
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">FPS / UPS</span>
        <div style="font-size: 18px; font-weight: bold;"><span id="fps-val" style="color: #3fb950;">0</span> / <span id="ups-val" style="color: #58a6ff;">0</span></div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Player Grounded</span>
        <div id="grounded-val" style="font-size: 18px; font-weight: bold; color: #f0883e;">NO</div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Coyote Time</span>
        <div id="coyote-val" style="font-size: 16px; font-weight: bold; color: #79c0ff;">0.00s</div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Jump Buffer</span>
        <div id="buffer-val" style="font-size: 16px; font-weight: bold; color: #bc8cff;">0.00s</div>
      </div>
      <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <span style="color: #8b949e; font-size: 11px;">Velocity (VX | VY)</span>
        <div id="velocity-val" style="font-size: 13px; font-weight: bold; color: #e6edf3; margin-top: 4px;">0 | 0</div>
      </div>
    </div>

    <div style="background: #161b22; padding: 10px 14px; border-radius: 6px; border: 1px solid #30363d; margin-bottom: 12px; font-size: 12px;">
      Fitur Game Feel Aktif:
      <strong style="color: #79c0ff;">Coyote Time (120ms)</strong> (bisa lompat setelah keluar tebing),
      <strong style="color: #bc8cff;">Jump Buffer (120ms)</strong> (antre lompat sebelum mendarat), dan
      <strong style="color: #3fb950;">Variable Jump</strong> (tekan sebentar = lompat pendek, tahan = lompat tinggi).
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
const groundedEl = document.querySelector<HTMLDivElement>('#grounded-val')!;
const coyoteEl = document.querySelector<HTMLDivElement>('#coyote-val')!;
const bufferEl = document.querySelector<HTMLDivElement>('#buffer-val')!;
const velocityEl = document.querySelector<HTMLDivElement>('#velocity-val')!;

// Inisialisasi InputManager
const input = new InputManager();

// Inisialisasi Camera2D
const camera = new Camera2D({
  viewportWidth: CANVAS_WIDTH,
  viewportHeight: CANVAS_HEIGHT,
  worldBounds: { minX: 0, minY: 0, maxX: WORLD_WIDTH, maxY: WORLD_HEIGHT },
  smoothFactor: 0.1,
  deadzone: { width: 100, height: 70 },
});

// Inisialisasi ECS World
const world = new World();

// Daftarkan Sistem: Input -> Controller -> Physics -> Camera -> Render
const renderSystem = new RenderSystem(ctx, camera, WORLD_WIDTH, WORLD_HEIGHT);
world.addSystem(new PlatformerControllerSystem(input));
world.addSystem(new PhysicsSystem({ gravity: 980 }));
world.addSystem(new CameraFollowSystem(camera));
world.addSystem(renderSystem);

// ==========================================
// 4. LEVEL DESIGN (Lantai, Platform, Dinding)
// ==========================================

function createPlatform(x: number, y: number, w: number, h: number, label: string = '') {
  const entity = world.createEntity();
  world.addComponent(entity, new TransformComponent(x, y));
  world.addComponent(entity, new ColliderComponent(w, h, 0, 0, true));
  world.addComponent(entity, new SolidObstacleComponent());
  world.addComponent(entity, new RenderableComponent(w, h, '#1f293d', label));
  return entity;
}

createPlatform(0, 290, WORLD_WIDTH, 110, 'GROUND');
createPlatform(200, 230, 140, 20, 'Platform 1');
createPlatform(420, 180, 140, 20, 'Platform 2');
createPlatform(640, 130, 160, 20, 'Platform 3');
createPlatform(900, 190, 200, 20, 'Long Bridge');
createPlatform(1200, 230, 140, 20, 'Step');
createPlatform(1450, 160, 180, 20, 'High Ledge');
createPlatform(1750, 220, 220, 20, 'Final Bridge');

createPlatform(360, 200, 24, 90, 'WALL');
createPlatform(820, 100, 24, 190, 'TOWER');
createPlatform(1380, 120, 24, 170, 'PILLAR');

// ==========================================
// 5. PEMAIN (PLAYER)
// ==========================================

const player = world.createEntity();
world.addComponent(player, new TransformComponent(60, 200));
world.addComponent(player, new VelocityComponent(0, 0));
world.addComponent(player, new ColliderComponent(28, 36, 0, 0, false));
world.addComponent(
  player,
  new RigidBodyComponent({ mass: 1, useGravity: true, terminalVelocity: 850 })
);
world.addComponent(player, new RenderableComponent(28, 36, '#3fb950', 'HERO'));
world.addComponent(
  player,
  new PlatformerControllerComponent({
    moveSpeed: 230,
    jumpForce: 520,
    coyoteDuration: 0.12,
    jumpBufferDuration: 0.12,
    jumpCutMultiplier: 0.5,
  })
);

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

    const body = world.getComponent(player, RigidBodyComponent);
    const vel = world.getComponent(player, VelocityComponent);
    const ctrl = world.getComponent(player, PlatformerControllerComponent);

    if (body) {
      groundedEl.textContent = body.isGrounded ? 'YES (On Floor)' : 'NO (In Air)';
      groundedEl.style.color = body.isGrounded ? '#3fb950' : '#f0883e';
    }

    if (ctrl) {
      coyoteEl.textContent = `${ctrl.coyoteTimer.toFixed(2)}s`;
      coyoteEl.style.color = ctrl.coyoteTimer > 0 ? '#3fb950' : '#8b949e';

      bufferEl.textContent = `${ctrl.jumpBufferTimer.toFixed(2)}s`;
      bufferEl.style.color = ctrl.jumpBufferTimer > 0 ? '#bc8cff' : '#8b949e';
    }

    if (vel) {
      velocityEl.textContent = `${Math.round(vel.vx)} | ${Math.round(vel.vy)}`;
    }
  },
});

loop.start();
