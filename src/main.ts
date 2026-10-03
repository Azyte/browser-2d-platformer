import { GameLoop } from './core/GameLoop';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Elemen #app tidak ditemukan');

app.innerHTML = `
  <div style="font-family: monospace; padding: 20px; background: #111; color: #0f0; min-height: 100vh;">
    <h1 style="margin-top: 0;">Custom 2D Platformer Engine</h1>
    <p>Status: <span id="loop-status">Running</span></p>
    <p>FPS (Render Frame per Detik): <span id="fps-val">0</span></p>
    <p>UPS (Logic Updates per Detik): <span id="ups-val">0</span></p>
    <p>Interpolation Alpha: <span id="alpha-val">0.00</span></p>
    <canvas id="game-canvas" width="480" height="120" style="border: 1px solid #333; background: #000;"></canvas>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Elemen #game-canvas tidak ditemukan');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context tidak didukung');

const fpsEl = document.querySelector<HTMLSpanElement>('#fps-val')!;
const upsEl = document.querySelector<HTMLSpanElement>('#ups-val')!;
const alphaEl = document.querySelector<HTMLSpanElement>('#alpha-val')!;

// Mock posisi objek untuk memvisualisasikan render interpolation
let prevX = 20;
let currentX = 20;
const speed = 120; // pixel per detik

const loop = new GameLoop({
  update: (fixedDt: number) => {
    prevX = currentX;
    currentX += speed * fixedDt;
    if (currentX > canvas.width - 40) {
      currentX = 20;
      prevX = 20;
    }
  },
  render: (alpha: number) => {
    // Interpolasi posisi antara tick sebelumnya dan saat ini
    const renderX = prevX + (currentX - prevX) * alpha;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Kotak hijau bergerak dengan posisi terinterpolasi
    ctx.fillStyle = '#0f0';
    ctx.fillRect(renderX, 40, 30, 30);

    // Update teks info
    fpsEl.textContent = loop.fps.toString();
    upsEl.textContent = loop.ups.toString();
    alphaEl.textContent = alpha.toFixed(3);
  },
});

loop.start();
