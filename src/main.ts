import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { World } from './ecs/World';
import { Camera2D } from './render/Camera2D';
import { TransformComponent } from './physics/TransformComponent';
import { VelocityComponent } from './physics/VelocityComponent';
import {
  ColliderComponent,
  SolidObstacleComponent,
} from './physics/PhysicsComponents';
import {
  StatsComponent,
  CombatComponent,
  NameplateComponent,
  MonsterAIComponent,
  SimulatedPlayerComponent,
} from './rpg/RPGComponents';
import { TopDownMovementSystem } from './rpg/TopDownMovementSystem';
import { CombatSystem } from './rpg/CombatSystem';
import { MonsterAISystem } from './rpg/MonsterAISystem';
import { SimulatedMMOPlayerSystem } from './rpg/SimulatedMMOPlayerSystem';
import { ChatManager } from './rpg/ChatSystem';
import { MMORenderSystem, MMOVisualComponent } from './rpg/MMORenderSystem';
import { QuestManager } from './rpg/QuestSystem';
import { LootSystem } from './rpg/LootSystem';
import { SoundSynthesizer } from './audio/SoundSynthesizer';
import { DebugRenderSystem } from './render/DebugRenderSystem';
import type { Entity } from './ecs/Entity';

// ============================================================================
// 1. KONFIGURASI DUNIA & LAYOUT RESPONSIVE (ANTI-OFFSIDE)
// ============================================================================

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Elemen #app tidak ditemukan');

app.innerHTML = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 14px; background: #090d13; color: #e6edf3; min-height: 100vh; box-sizing: border-box; overflow-x: hidden;">
    <div style="max-width: 860px; margin: 0 auto; box-sizing: border-box; width: 100%;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #30363d; padding-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h1 style="margin: 0; color: #58a6ff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
            ⚔️ Aethelgard 2D: Top-Down MMORPG Engine
          </h1>
          <p style="color: #8b949e; margin: 4px 0 0 0; font-size: 12px;">
            Simulated MMO World - Custom ECS, Depth Y-Sorting, Autonomous Bots & Quests (GDGoC Portfolio)
          </p>
        </div>
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <span style="background: #238636; color: #ffffff; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">
            🟢 Online (CH 1)
          </span>
          <button id="btn-debug-toggle" style="background: #21262d; border: 1px solid #388bfd; color: #58a6ff; padding: 3px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600;">
            ⚙️ Debug (F3): OFF
          </button>
        </div>
      </div>

      <!-- Metrik Bar Grid (Responsif & Anti-Offside) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(115px, 1fr)); gap: 10px; margin-bottom: 12px; width: 100%; box-sizing: border-box;">
        <div style="background: #161b22; padding: 8px 12px; border-radius: 6px; border: 1px solid #30363d;">
          <div style="color: #8b949e; font-size: 10px; font-weight: 500;">FPS / UPS</div>
          <div style="font-size: 16px; font-weight: bold; margin-top: 2px;">
            <span id="fps-val" style="color: #3fb950;">0</span> / <span id="ups-val" style="color: #58a6ff;">0</span>
          </div>
        </div>
        <div style="background: #161b22; padding: 8px 12px; border-radius: 6px; border: 1px solid #30363d;">
          <div style="color: #8b949e; font-size: 10px; font-weight: 500;">Hero Level</div>
          <div id="player-lvl" style="font-size: 16px; font-weight: bold; color: #e3b341; margin-top: 2px;">Lv. 1</div>
        </div>
        <div style="background: #161b22; padding: 8px 12px; border-radius: 6px; border: 1px solid #30363d;">
          <div style="color: #8b949e; font-size: 10px; font-weight: 500;">Gold Stash</div>
          <div id="player-gold" style="font-size: 16px; font-weight: bold; color: #f0883e; margin-top: 2px;">0 G</div>
        </div>
        <div style="background: #161b22; padding: 8px 12px; border-radius: 6px; border: 1px solid #30363d;">
          <div style="color: #8b949e; font-size: 10px; font-weight: 500;">Visible Entities</div>
          <div id="entities-val" style="font-size: 16px; font-weight: bold; color: #79c0ff; margin-top: 2px;">0</div>
        </div>
        <div style="background: #161b22; padding: 8px 12px; border-radius: 6px; border: 1px solid #30363d;">
          <div style="color: #8b949e; font-size: 10px; font-weight: 500;">Depth Sorting</div>
          <div style="font-size: 12px; font-weight: bold; color: #3fb950; margin-top: 4px;">Active (Y-Base)</div>
        </div>
      </div>

      <!-- Canvas Container (Responsif tanpa offside horizontal) -->
      <div style="position: relative; width: 100%; max-width: 800px; margin: 0 auto; box-sizing: border-box;">
        <canvas id="game-canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" style="display: block; width: 100%; max-width: 800px; height: auto; aspect-ratio: 800 / 480; border: 1px solid #30363d; background: #0b130e; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); box-sizing: border-box;"></canvas>
      </div>

      <!-- Mobile Touch Gamepad Controls -->
      <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; background: #161b22; padding: 10px 14px; border-radius: 8px; border: 1px solid #30363d; flex-wrap: wrap; gap: 10px;">
        <!-- Virtual D-Pad -->
        <div style="display: inline-grid; grid-template-columns: repeat(3, 38px); grid-template-rows: repeat(3, 34px); gap: 4px; user-select: none;">
          <div></div>
          <button id="touch-up" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; font-weight: bold; cursor: pointer;">▲</button>
          <div></div>
          <button id="touch-left" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; font-weight: bold; cursor: pointer;">◄</button>
          <div style="background: #0d1117; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #484f58;">PAD</div>
          <button id="touch-right" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; font-weight: bold; cursor: pointer;">►</button>
          <div></div>
          <button id="touch-down" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; font-weight: bold; cursor: pointer;">▼</button>
          <div></div>
        </div>

        <!-- Quick Chat & Stress Test Buttons -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button id="btn-chat-wave" style="background: #21262d; border: 1px solid #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
              👋 Sapa
            </button>
            <button id="btn-chat-lfg" style="background: #21262d; border: 1px solid #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
              ⚔️ LFG Fenrir
            </button>
            <button id="btn-chat-heal" style="background: #21262d; border: 1px solid #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
              🧪 Minta Heal
            </button>
          </div>
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button id="btn-stress-mobs" style="background: #238636; border: none; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
              ⚡ +20 Slimes
            </button>
            <button id="btn-stress-bots" style="background: #6e40c9; border: none; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
              🤖 +4 Bots
            </button>
            <button id="btn-audio-toggle" style="background: #1f6feb; border: none; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
              🔊 Sound: ON
            </button>
          </div>
        </div>

        <!-- Virtual Action Buttons -->
        <div style="display: flex; gap: 6px; user-select: none;">
          <button id="touch-attack" style="width: 48px; height: 48px; background: #da3633; border: 1px solid #f85149; color: #ffffff; border-radius: 50%; font-size: 11px; font-weight: bold; cursor: pointer;">
            ATK
          </button>
          <button id="touch-skill" style="width: 48px; height: 48px; background: #8957e5; border: 1px solid #bc8cff; color: #ffffff; border-radius: 50%; font-size: 10px; font-weight: bold; cursor: pointer;">
            SKILL
          </button>
          <button id="touch-hp" style="width: 42px; height: 42px; background: #238636; border: 1px solid #3fb950; color: #ffffff; border-radius: 50%; font-size: 10px; font-weight: bold; cursor: pointer; align-self: center;">
            HP
          </button>
          <button id="touch-mp" style="width: 42px; height: 42px; background: #1f6feb; border: 1px solid #58a6ff; color: #ffffff; border-radius: 50%; font-size: 10px; font-weight: bold; cursor: pointer; align-self: center;">
            MP
          </button>
        </div>
      </div>

      <!-- Controls & Features Grid (Responsif Anti-Offside) -->
      <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; width: 100%; box-sizing: border-box;">
        <div style="background: #161b22; padding: 12px 14px; border-radius: 6px; border: 1px solid #30363d; font-size: 12px; line-height: 1.6;">
          <div style="font-weight: 600; color: #79c0ff; margin-bottom: 6px;">🎮 Keyboard & Gamepad:</div>
          <div><strong style="color: #e6edf3;">[W, A, S, D]</strong> or <strong style="color: #e6edf3;">[Panah]</strong>: Jalan 8 Arah (Normalisasi diagonal)</div>
          <div><strong style="color: #e6edf3;">[Space]</strong> or <strong style="color: #e6edf3;">[J]</strong>: Basic Attack Tebasan Pedang</div>
          <div><strong style="color: #e6edf3;">[K]</strong> or <strong style="color: #e6edf3;">[1]</strong>: Whirlwind Slash (20 MP, 75px Area, 2.2x Damage)</div>
          <div><strong style="color: #e6edf3;">[Q]</strong>: Minum HP Potion (+50 HP) | <strong style="color: #e6edf3;">[E]</strong>: MP Potion (+35 MP)</div>
          <div><strong style="color: #e6edf3;">[F3]</strong>: Toggle Engine Debug Hitboxes & AI Radar</div>
        </div>
        <div style="background: #161b22; padding: 12px 14px; border-radius: 6px; border: 1px solid #30363d; font-size: 12px; color: #8b949e; line-height: 1.5;">
          <div style="font-weight: 600; color: #e3b341; margin-bottom: 4px;">✨ Fitur Unggulan Engine:</div>
          <div>- Bot pemain otonom berburu dan chatting secara dinamis.</div>
          <div>- Depth Y-Sorting: Karakter melangkah di depan/belakang pohon.</div>
          <div>- Stress Test: Klik tombol +20 Slimes untuk menguji performa 60 FPS.</div>
          <div>- Web Audio Synthesizer: Suara retro prosedural tanpa file eksternal.</div>
        </div>
      </div>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Canvas element tidak ditemukan');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context tidak didukung');

const fpsEl = document.querySelector<HTMLSpanElement>('#fps-val')!;
const upsEl = document.querySelector<HTMLSpanElement>('#ups-val')!;
const playerLvlEl = document.querySelector<HTMLDivElement>('#player-lvl')!;
const playerGoldEl = document.querySelector<HTMLDivElement>('#player-gold')!;
const entitiesEl = document.querySelector<HTMLDivElement>('#entities-val')!;
const btnDebugToggle = document.querySelector<HTMLButtonElement>('#btn-debug-toggle')!;
const btnAudioToggle = document.querySelector<HTMLButtonElement>('#btn-audio-toggle')!;
const btnStressMobs = document.querySelector<HTMLButtonElement>('#btn-stress-mobs')!;
const btnStressBots = document.querySelector<HTMLButtonElement>('#btn-stress-bots')!;
const btnChatWave = document.querySelector<HTMLButtonElement>('#btn-chat-wave')!;
const btnChatLfg = document.querySelector<HTMLButtonElement>('#btn-chat-lfg')!;
const btnChatHeal = document.querySelector<HTMLButtonElement>('#btn-chat-heal')!;

// Touch pad buttons
const touchUp = document.querySelector<HTMLButtonElement>('#touch-up')!;
const touchDown = document.querySelector<HTMLButtonElement>('#touch-down')!;
const touchLeft = document.querySelector<HTMLButtonElement>('#touch-left')!;
const touchRight = document.querySelector<HTMLButtonElement>('#touch-right')!;
const touchAttack = document.querySelector<HTMLButtonElement>('#touch-attack')!;
const touchSkill = document.querySelector<HTMLButtonElement>('#touch-skill')!;
const touchHp = document.querySelector<HTMLButtonElement>('#touch-hp')!;
const touchMp = document.querySelector<HTMLButtonElement>('#touch-mp')!;

// ============================================================================
// 2. INISIALISASI ENGINE & MANAGERS
// ============================================================================

const input = new InputManager();
const chatManager = new ChatManager();
const questManager = new QuestManager();
const lootSystem = new LootSystem();
const soundSynth = new SoundSynthesizer({ enabled: true, volume: 0.3 });
const debugSystem = new DebugRenderSystem();
const world = new World();

const camera = new Camera2D({
  viewportWidth: CANVAS_WIDTH,
  viewportHeight: CANVAS_HEIGHT,
  worldBounds: { minX: 0, minY: 0, maxX: WORLD_WIDTH, maxY: WORLD_HEIGHT },
  smoothFactor: 0.12,
  deadzone: { width: 80, height: 60 },
});

// Daftarkan Sistem Gameplay
const topDownMovementSystem = new TopDownMovementSystem({
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
});
const combatSystem = new CombatSystem();
const monsterAISystem = new MonsterAISystem(combatSystem);
const simulatedPlayerSystem = new SimulatedMMOPlayerSystem(combatSystem, chatManager);
const mmoRenderSystem = new MMORenderSystem(
  ctx,
  camera,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  chatManager,
  questManager
);

// Toggle Debug Overlay
function toggleDebug(): void {
  const isDebug = debugSystem.toggle();
  btnDebugToggle.textContent = isDebug ? '⚙️ Debug (F3): ON' : '⚙️ Debug (F3): OFF';
  btnDebugToggle.style.background = isDebug ? '#1f6feb' : '#21262d';
  btnDebugToggle.style.color = isDebug ? '#ffffff' : '#58a6ff';
}

btnDebugToggle.addEventListener('click', toggleDebug);
window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault();
    toggleDebug();
  }
});

// Audio Toggle
btnAudioToggle.addEventListener('click', () => {
  soundSynth.initContext();
  const isMuted = soundSynth.toggleMute();
  btnAudioToggle.textContent = isMuted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
  btnAudioToggle.style.background = isMuted ? '#6e7681' : '#1f6feb';
});

// Quick Emotes
btnChatWave.addEventListener('click', () => {
  soundSynth.initContext();
  chatManager.addMessage('Hero (You)', 'Greetings, fellow adventurers!', 'player');
  setTimeout(() => {
    chatManager.addMessage('HealerKun', 'May the light guide your blade, Hero!', 'other_player');
  }, 1000);
});

btnChatLfg.addEventListener('click', () => {
  soundSynth.initContext();
  chatManager.addMessage('Hero (You)', 'Looking for party to hunt Alpha Wolf Fenrir!', 'player');
  setTimeout(() => {
    chatManager.addMessage('Valkyrie', 'Count me in! Regrouping at Wolf Woods!', 'other_player');
  }, 1200);
});

btnChatHeal.addEventListener('click', () => {
  soundSynth.initContext();
  chatManager.addMessage('Hero (You)', 'Need healing or extra potions!', 'player');
  setTimeout(() => {
    chatManager.addMessage('HealerKun', 'Stay behind me! Using Blessing of Life!', 'other_player');
  }, 900);
});

// Virtual Touch Pad Handlers (Mendukung sentuhan mobile & klik mouse)
function bindTouchButton(el: HTMLElement, action: 'up' | 'down' | 'left' | 'right' | 'attack' | 'skill' | 'potionHp' | 'potionMp') {
  const down = (e: Event) => {
    e.preventDefault();
    soundSynth.initContext();
    input.setVirtualAction(action, true);
  };
  const up = (e: Event) => {
    e.preventDefault();
    input.setVirtualAction(action, false);
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
}

bindTouchButton(touchUp, 'up');
bindTouchButton(touchDown, 'down');
bindTouchButton(touchLeft, 'left');
bindTouchButton(touchRight, 'right');
bindTouchButton(touchAttack, 'attack');
bindTouchButton(touchSkill, 'skill');
bindTouchButton(touchHp, 'potionHp');
bindTouchButton(touchMp, 'potionMp');

// Pesan sambutan
chatManager.addMessage('System', 'Welcome to Emerald Sanctuary! Simulated MMO World initialized.', 'system');
chatManager.addMessage('System', 'Defeat monsters to complete Quests and earn EXP & Loot!', 'system');

// ============================================================================
// 3. GENERASI LINGKUNGAN DUNIA (TREES & ROCKS)
// ============================================================================

interface RespawnRecord {
  entity: Entity;
  respawnTimer: number;
  homeX: number;
  homeY: number;
  maxHp: number;
}

const deadMonsters: RespawnRecord[] = [];

function createTree(x: number, y: number): Entity {
  const tree = world.createEntity();
  world.addComponent(tree, new TransformComponent(x, y));
  world.addComponent(tree, new ColliderComponent(28, 22, 18, 52, true));
  world.addComponent(tree, new SolidObstacleComponent());
  world.addComponent(
    tree,
    new MMOVisualComponent({ width: 64, height: 80, visualType: 'tree' })
  );
  return tree;
}

function createRock(x: number, y: number): Entity {
  const rock = world.createEntity();
  world.addComponent(rock, new TransformComponent(x, y));
  world.addComponent(rock, new ColliderComponent(44, 28, 2, 4, true));
  world.addComponent(rock, new SolidObstacleComponent());
  world.addComponent(
    rock,
    new MMOVisualComponent({ width: 48, height: 36, visualType: 'rock' })
  );
  return rock;
}

for (let x = 0; x < WORLD_WIDTH; x += 64) {
  createTree(x, 0);
  createTree(x, WORLD_HEIGHT - 88);
}
for (let y = 60; y < WORLD_HEIGHT - 88; y += 70) {
  createTree(0, y);
  createTree(WORLD_WIDTH - 64, y);
}

createTree(250, 160);
createTree(320, 180);
createTree(220, 240);
createRock(480, 190);
createRock(530, 210);

createTree(750, 420);
createTree(820, 400);
createTree(890, 440);
createRock(1100, 360);

createTree(1320, 720);
createTree(1390, 750);
createTree(1460, 700);
createRock(1580, 820);
createRock(1630, 850);

createTree(1800, 320);
createTree(1880, 290);
createTree(1950, 340);
createRock(1900, 450);

// ============================================================================
// 4. SPAWN PEMAIN UTAMA (HERO)
// ============================================================================

const player = world.createEntity();
world.addComponent(player, new TransformComponent(400, 350));
world.addComponent(player, new VelocityComponent(0, 0));
world.addComponent(player, new ColliderComponent(24, 24, 4, 4, false));
world.addComponent(
  player,
  new StatsComponent({
    hp: 160,
    maxHp: 160,
    mp: 80,
    maxMp: 80,
    level: 1,
    attack: 24,
    defense: 8,
    critChance: 0.25,
    gold: 50,
    hpPotions: 5,
    mpPotions: 3,
  })
);
world.addComponent(
  player,
  new CombatComponent({
    attackRange: 52,
    attackCooldown: 0.38,
    skillName: 'Whirlwind Slash',
    skillCostMp: 20,
    skillCooldown: 2.5,
    skillRange: 75,
    skillMultiplier: 2.2,
  })
);
world.addComponent(player, new NameplateComponent('Hero (You)', 'player', 'Apprentice Knight', true));
world.addComponent(
  player,
  new MMOVisualComponent({ width: 32, height: 32, visualType: 'player', color: '#3fb950' })
);

camera.follow(400, 350, true);

// ============================================================================
// 5. SPAWN BOT PEMAIN
// ============================================================================

function createBotPlayer(
  x: number,
  y: number,
  name: string,
  title: string,
  level: number,
  primaryColor: string,
  secondaryColor: string
): Entity {
  const bot = world.createEntity();
  world.addComponent(bot, new TransformComponent(x, y));
  world.addComponent(bot, new VelocityComponent(0, 0));
  world.addComponent(bot, new ColliderComponent(24, 24, 4, 4, false));
  world.addComponent(
    bot,
    new StatsComponent({
      hp: 140 + level * 20,
      maxHp: 140 + level * 20,
      mp: 60 + level * 15,
      maxMp: 60 + level * 15,
      level,
      attack: 18 + level * 4,
      defense: 6 + level * 2,
      critChance: 0.2,
      gold: level * 80,
      hpPotions: 4,
      mpPotions: 3,
    })
  );
  world.addComponent(
    bot,
    new CombatComponent({
      attackRange: 48,
      attackCooldown: 0.45,
      skillName: 'Heavy Strike',
      skillCostMp: 15,
      skillCooldown: 3.5,
      skillRange: 56,
    })
  );
  world.addComponent(bot, new NameplateComponent(name, 'other_player', title, true));
  world.addComponent(
    bot,
    new MMOVisualComponent({
      width: 32,
      height: 32,
      visualType: 'bot',
      color: primaryColor,
      secondaryColor,
    })
  );
  world.addComponent(bot, new SimulatedPlayerComponent());
  return bot;
}

createBotPlayer(470, 360, 'Valkyrie', 'Swordmaster', 3, '#da3633', '#1f6feb');
createBotPlayer(530, 320, 'ShadowBlade', 'Shadow Rogue', 4, '#21262d', '#6e40c9');
createBotPlayer(340, 390, 'Merlin', 'Archmage', 3, '#388bfd', '#1f242c');
createBotPlayer(370, 310, 'HealerKun', 'Cleric', 2, '#f0f6fc', '#d29922');

// ============================================================================
// 6. SPAWN MONSTER & WORLD BOSS FENRIR
// ============================================================================

function createMonster(
  x: number,
  y: number,
  name: string,
  level: number,
  visualType: 'slime' | 'goblin' | 'wolf' | 'boss',
  color: string,
  width: number = 32,
  height: number = 32
): Entity {
  const mob = world.createEntity();
  world.addComponent(mob, new TransformComponent(x, y));
  world.addComponent(mob, new VelocityComponent(0, 0));
  world.addComponent(mob, new ColliderComponent(width - 6, height - 6, 3, 3, false));

  const isBoss = visualType === 'boss';
  const hp = isBoss ? 750 : 60 + level * 25;
  const attack = isBoss ? 38 : 12 + level * 3;
  const def = isBoss ? 12 : 3 + level;

  world.addComponent(
    mob,
    new StatsComponent({
      hp,
      maxHp: hp,
      mp: 40,
      maxMp: 40,
      level,
      attack,
      defense: def,
      exp: isBoss ? 450 : 25 + level * 15,
      gold: isBoss ? 250 : 15 + level * 8,
    })
  );
  world.addComponent(
    mob,
    new CombatComponent({
      attackRange: isBoss ? 64 : 44,
      attackCooldown: isBoss ? 0.7 : 0.6,
      skillName: isBoss ? 'Titan Slam' : 'Bite',
      skillCostMp: 10,
      skillCooldown: isBoss ? 4.0 : 6.0,
      skillRange: isBoss ? 80 : 48,
    })
  );
  world.addComponent(
    mob,
    new NameplateComponent(name, 'monster', isBoss ? 'World Boss' : '', true)
  );
  world.addComponent(
    mob,
    new MonsterAIComponent(x, y, isBoss ? 220 : 140, isBoss ? 400 : 260)
  );
  world.addComponent(
    mob,
    new MMOVisualComponent({
      width,
      height,
      visualType,
      color,
    })
  );
  return mob;
}

// Forest Slimes
createMonster(620, 320, 'Forest Slime', 1, 'slime', '#3fb950');
createMonster(680, 260, 'Forest Slime', 1, 'slime', '#3fb950');
createMonster(720, 380, 'Green Ooze', 2, 'slime', '#2ea043');
createMonster(800, 310, 'Green Ooze', 2, 'slime', '#2ea043');

// Goblin Glade
createMonster(1080, 520, 'Goblin Scout', 3, 'goblin', '#d29922');
createMonster(1160, 580, 'Goblin Raider', 3, 'goblin', '#bf8700');
createMonster(1240, 500, 'Goblin Berserker', 4, 'goblin', '#9e6a03');

// Wolf Woods
createMonster(1540, 280, 'Timber Wolf', 4, 'wolf', '#8b949e');
createMonster(1620, 350, 'Dire Wolf', 5, 'wolf', '#6e7681');
createMonster(1700, 290, 'Dire Wolf Alpha', 5, 'wolf', '#545d68');

// World Boss: Alpha Wolf Fenrir
createMonster(1950, 680, 'Alpha Wolf Fenrir', 7, 'boss', '#3d1f5e', 54, 54);

// Stress Test Buttons
btnStressMobs.addEventListener('click', () => {
  for (let i = 0; i < 20; i++) {
    const rx = 500 + Math.random() * 1200;
    const ry = 250 + Math.random() * 1000;
    createMonster(rx, ry, 'Wild Slime', 1, 'slime', '#3fb950');
  }
  chatManager.addMessage('System', 'Stress Test: Spawned +20 Wild Slimes!', 'system');
});

btnStressBots.addEventListener('click', () => {
  const botNames = ['Lancelot', 'Gawain', 'Ygritte', 'Ezio'];
  for (let i = 0; i < botNames.length; i++) {
    const rx = 350 + Math.random() * 200;
    const ry = 300 + Math.random() * 150;
    createBotPlayer(rx, ry, botNames[i], 'Adventurer', 2, '#388bfd', '#1f242c');
  }
  chatManager.addMessage('System', 'Stress Test: Spawned +4 Simulated Bots!', 'system');
});

// ============================================================================
// 7. GAME LOOP & INTERAKSI
// ============================================================================

function findNearestMonster(
  fromX: number,
  fromY: number,
  maxRadius: number
): { entity: Entity; distance: number } | null {
  const monsters = world.query(MonsterAIComponent, TransformComponent, StatsComponent);
  let best: { entity: Entity; distance: number } | null = null;

  for (const m of monsters) {
    const stats = world.getComponent(m, StatsComponent);
    const trans = world.getComponent(m, TransformComponent);
    if (!stats || !trans || stats.hp <= 0) continue;

    const dx = trans.x - fromX;
    const dy = trans.y - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= maxRadius && (!best || dist < best.distance)) {
      best = { entity: m, distance: dist };
    }
  }

  return best;
}

const loop = new GameLoop({
  update: (fixedDt: number) => {
    const playerTrans = world.getComponent(player, TransformComponent);
    const playerVel = world.getComponent(player, VelocityComponent);
    const playerStats = world.getComponent(player, StatsComponent);
    const playerCombat = world.getComponent(player, CombatComponent);

    // 1. Kontrol Pergerakan Pemain (WASD / Arrows / Touch D-pad)
    if (playerTrans && playerVel && playerStats && playerStats.hp > 0) {
      let dx = 0;
      let dy = 0;
      if (input.isActionDown('left')) dx -= 1;
      if (input.isActionDown('right')) dx += 1;
      if (input.isActionDown('up')) dy -= 1;
      if (input.isActionDown('down')) dy += 1;

      const len = Math.sqrt(dx * dx + dy * dy);
      const speed = 190;

      if (len > 0) {
        playerVel.vx = (dx / len) * speed;
        playerVel.vy = (dy / len) * speed;
      } else {
        playerVel.vx = 0;
        playerVel.vy = 0;
      }

      // 2. Aksi Tempur: Basic Attack (Space / J / Touch ATK)
      if (input.isActionJustPressed('attack') && playerCombat) {
        playerCombat.isAttacking = true;
        soundSynth.playAttack();

        const target = findNearestMonster(playerTrans.x + 16, playerTrans.y + 16, playerCombat.attackRange + 14);
        if (target) {
          combatSystem.executeBasicAttack(world, player, target.entity);
          soundSynth.playHit();
        }
      }

      // 3. Aksi Tempur: Whirlwind Slash (K / 1 / Touch SKILL)
      if (input.isActionJustPressed('skill') && playerCombat) {
        const target = findNearestMonster(playerTrans.x + 16, playerTrans.y + 16, playerCombat.skillRange);
        if (target) {
          combatSystem.executeSkill(world, player, target.entity);
          soundSynth.playWhirlwind();
        } else if (playerStats.mp >= playerCombat.skillCostMp && playerCombat.currentSkillCooldown <= 0) {
          playerStats.mp -= playerCombat.skillCostMp;
          playerCombat.currentSkillCooldown = playerCombat.skillCooldown;
          soundSynth.playWhirlwind();
          combatSystem.spawnFloatingText(
            world,
            playerTrans.x + 6,
            playerTrans.y - 12,
            'Whirlwind Slash!',
            '#bc8cff',
            true
          );
        }
      }

      // 4. Minum Potion (Q = HP, E = MP, Touch HP/MP)
      if (input.isActionJustPressed('potionHp')) {
        if (combatSystem.useHpPotion(playerStats)) {
          soundSynth.playPotion();
          combatSystem.spawnFloatingText(world, playerTrans.x + 6, playerTrans.y - 14, '+50 HP', '#3fb950', false);
        }
      }
      if (input.isActionJustPressed('potionMp')) {
        if (combatSystem.useMpPotion(playerStats)) {
          soundSynth.playPotion();
          combatSystem.spawnFloatingText(world, playerTrans.x + 6, playerTrans.y - 14, '+35 MP', '#1f6feb', false);
        }
      }
    }

    // 5. Update Sistem AI Monster & Bot MMO
    monsterAISystem.update(world, fixedDt);
    simulatedPlayerSystem.update(world, fixedDt);

    // 6. Update Pergerakan Fisika Top-Down (Sliding Collisions)
    topDownMovementSystem.update(world, fixedDt);

    // 7. Update Loot Drops & Auto Pickup
    lootSystem.update(world, player, fixedDt, combatSystem, chatManager, soundSynth);

    // 8. Update Cooldown & Floating Text Combat
    combatSystem.update(world, fixedDt);

    // 9. Evaluasi Kematian Monster, Drop Loot & Progres Quest
    const monsterEntities = world.query(MonsterAIComponent, StatsComponent, TransformComponent);
    for (const m of monsterEntities) {
      const mStats = world.getComponent(m, StatsComponent);
      const mTrans = world.getComponent(m, TransformComponent);
      const mPlate = world.getComponent(m, NameplateComponent);
      const mAi = world.getComponent(m, MonsterAIComponent);

      if (mStats && mTrans && mStats.hp <= 0 && mAi) {
        const lootX = mTrans.x;
        const lootY = mTrans.y;

        if (mStats.level >= 7) {
          lootSystem.spawnLoot(world, lootX, lootY, {
            itemName: 'Fenrir Crest',
            itemType: 'equipment',
            value: 1,
            statBonus: { attack: 10, defense: 5, maxHp: 40 },
          });
          lootSystem.spawnLoot(world, lootX + 24, lootY, {
            itemName: 'Gold Hoard',
            itemType: 'gold',
            value: 200,
          });
        } else {
          if (Math.random() < 0.6) {
            lootSystem.spawnLoot(world, lootX, lootY, {
              itemName: 'Gold Pouch',
              itemType: 'gold',
              value: 15 + mStats.level * 10,
            });
          } else {
            lootSystem.spawnLoot(world, lootX, lootY, {
              itemName: 'Health Potion',
              itemType: 'potion_hp',
              value: 1,
            });
          }
        }

        if (mPlate) {
          questManager.onMonsterKilled(mPlate.name, world, player, combatSystem, chatManager, soundSynth);
        }

        deadMonsters.push({
          entity: m,
          respawnTimer: 5.0,
          homeX: mAi.homeX,
          homeY: mAi.homeY,
          maxHp: mStats.maxHp,
        });

        mTrans.x = -9999;
        mTrans.y = -9999;
        mTrans.prevX = -9999;
        mTrans.prevY = -9999;
      }
    }

    // 10. Proses Timer Respawn Monster
    for (let i = deadMonsters.length - 1; i >= 0; i--) {
      const record = deadMonsters[i];
      record.respawnTimer -= fixedDt;

      if (record.respawnTimer <= 0) {
        const trans = world.getComponent(record.entity, TransformComponent);
        const stats = world.getComponent(record.entity, StatsComponent);
        const ai = world.getComponent(record.entity, MonsterAIComponent);

        if (trans && stats && ai) {
          trans.x = record.homeX;
          trans.y = record.homeY;
          trans.prevX = record.homeX;
          trans.prevY = record.homeY;
          stats.hp = record.maxHp;
          ai.state = 'idle';
          ai.stateTimer = 0;
          ai.targetEntity = null;
        }

        deadMonsters.splice(i, 1);
      }
    }

    // 11. Kamera Mengikuti Pemain Utama
    if (playerTrans) {
      camera.follow(playerTrans.x + 16, playerTrans.y + 16);
    }

    input.endFrame();
  },

  render: (alpha: number) => {
    // 1. Render gameplay MMORPG
    mmoRenderSystem.render(world, alpha, player);

    // 2. Render Debug Overlay jika aktif (F3)
    debugSystem.render(world, ctx, camera, alpha);

    // 3. Update metrik ke dashboard HTML
    fpsEl.textContent = loop.fps.toString();
    upsEl.textContent = loop.ups.toString();
    entitiesEl.textContent = mmoRenderSystem.visibleEntitiesCount.toString();

    const pStats = world.getComponent(player, StatsComponent);
    if (pStats) {
      playerLvlEl.textContent = `Lv. ${pStats.level}`;
      playerGoldEl.textContent = `${pStats.gold} G`;
    }
  },
});

loop.start();
