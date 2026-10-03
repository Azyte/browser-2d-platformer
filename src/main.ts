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
import type { Entity } from './ecs/Entity';

// ============================================================================
// 1. KONFIGURASI DUNIA GAME (WORLD CONFIG)
// ============================================================================

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;

// Setup DOM Layout
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Elemen #app tidak ditemukan');

app.innerHTML = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 18px 24px; background: #0d1117; color: #e6edf3; min-height: 100vh; box-sizing: border-box;">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #30363d; padding-bottom: 10px;">
      <div>
        <h1 style="margin: 0; color: #58a6ff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
          ⚔️ Aethelgard 2D: Top-Down MMORPG Engine
        </h1>
        <p style="color: #8b949e; margin: 4px 0 0 0; font-size: 13px;">
          Simulated MMO World - Custom ECS Architecture, Depth Y-Sorting & Autonomous Bots (GDGoC Portfolio)
        </p>
      </div>
      <div style="display: flex; gap: 8px;">
        <span style="background: #238636; color: #ffffff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">
          🟢 Server Online
        </span>
        <span style="background: #1f6feb; color: #ffffff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">
          Channel 1
        </span>
      </div>
    </div>

    <!-- Metrik Bar -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px;">
      <div style="background: #161b22; padding: 8px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <div style="color: #8b949e; font-size: 11px; font-weight: 500;">FPS / UPS</div>
        <div style="font-size: 17px; font-weight: bold; margin-top: 2px;">
          <span id="fps-val" style="color: #3fb950;">0</span> / <span id="ups-val" style="color: #58a6ff;">0</span>
        </div>
      </div>
      <div style="background: #161b22; padding: 8px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <div style="color: #8b949e; font-size: 11px; font-weight: 500;">Hero Level</div>
        <div id="player-lvl" style="font-size: 17px; font-weight: bold; color: #e3b341; margin-top: 2px;">Lv. 1</div>
      </div>
      <div style="background: #161b22; padding: 8px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <div style="color: #8b949e; font-size: 11px; font-weight: 500;">Gold Stash</div>
        <div id="player-gold" style="font-size: 17px; font-weight: bold; color: #f0883e; margin-top: 2px;">0 G</div>
      </div>
      <div style="background: #161b22; padding: 8px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <div style="color: #8b949e; font-size: 11px; font-weight: 500;">Visible Entities</div>
        <div id="entities-val" style="font-size: 17px; font-weight: bold; color: #79c0ff; margin-top: 2px;">0</div>
      </div>
      <div style="background: #161b22; padding: 8px 14px; border-radius: 6px; border: 1px solid #30363d;">
        <div style="color: #8b949e; font-size: 11px; font-weight: 500;">Depth Sorting</div>
        <div style="font-size: 13px; font-weight: bold; color: #3fb950; margin-top: 5px;">Active (Y-Base)</div>
      </div>
    </div>

    <!-- Canvas Container -->
    <div style="position: relative; display: inline-block;">
      <canvas id="game-canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" style="display: block; border: 1px solid #30363d; background: #0b130e; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);"></canvas>
    </div>

    <!-- Quick Guide -->
    <div style="margin-top: 14px; display: grid; grid-template-columns: 2fr 1fr; gap: 14px;">
      <div style="background: #161b22; padding: 12px 16px; border-radius: 6px; border: 1px solid #30363d; font-size: 13px; line-height: 1.6;">
        <div style="font-weight: 600; color: #79c0ff; margin-bottom: 6px;">🎮 Controls & Combat Guide:</div>
        <div><strong style="color: #e6edf3;">[W, A, S, D]</strong> or <strong style="color: #e6edf3;">[Arrows]</strong>: 8-Way Movement (Normalized diagonal speed)</div>
        <div><strong style="color: #e6edf3;">[Space]</strong> or <strong style="color: #e6edf3;">[J]</strong>: Basic Sword Attack (Single target in 52px range)</div>
        <div><strong style="color: #e6edf3;">[K]</strong> or <strong style="color: #e6edf3;">[1]</strong>: Whirlwind Slash Skill (20 MP, 75px AOE, 2.2x Damage)</div>
        <div><strong style="color: #e6edf3;">[Q]</strong>: Drink HP Potion (+50 HP) | <strong style="color: #e6edf3;">[E]</strong>: Drink MP Potion (+35 MP)</div>
      </div>
      <div style="background: #161b22; padding: 12px 16px; border-radius: 6px; border: 1px solid #30363d; font-size: 12px; color: #8b949e; line-height: 1.5;">
        <div style="font-weight: 600; color: #e3b341; margin-bottom: 4px;">✨ Simulated MMO Features:</div>
        <div>- Autonomous player bots hunt, level up, and chat dynamically.</div>
        <div>- Depth Y-Sorting: Walk in front and behind trees naturally.</div>
        <div>- Monster Leashing: Mobs return to nest and heal if lured too far.</div>
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

// ============================================================================
// 2. INISIALISASI ECS & ENGINE MANAGERS
// ============================================================================

const input = new InputManager();
const chatManager = new ChatManager();
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
  chatManager
);

// Kirim pesan sambutan di chat MMO
chatManager.addMessage('System', 'Welcome to Emerald Sanctuary! Simulated MMO World initialized.', 'system');
chatManager.addMessage('System', 'Defeat monsters to earn EXP & Gold. Beware of Alpha Wolf Fenrir!', 'system');

// ============================================================================
// 3. GENERASI DUNIA GAME (TREES, ROCKS, ENVIRONMENT)
// ============================================================================

interface RespawnRecord {
  entity: Entity;
  respawnTimer: number;
  homeX: number;
  homeY: number;
  maxHp: number;
}

const deadMonsters: RespawnRecord[] = [];

/**
 * Membuat objek pohon dengan collision di alas batang dan kanopi rindang.
 */
function createTree(x: number, y: number): Entity {
  const tree = world.createEntity();
  world.addComponent(tree, new TransformComponent(x, y));
  // Collider hanya diletakkan di pangkal batang (bawah) agar karakter bisa berjalan di belakang kanopi!
  world.addComponent(tree, new ColliderComponent(28, 22, 18, 52, true));
  world.addComponent(tree, new SolidObstacleComponent());
  world.addComponent(
    tree,
    new MMOVisualComponent({ width: 64, height: 80, visualType: 'tree' })
  );
  return tree;
}

/**
 * Membuat bongkahan batu granit padat.
 */
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

// Batas pagar pohon mengelilingi dunia game
for (let x = 0; x < WORLD_WIDTH; x += 64) {
  createTree(x, 0);
  createTree(x, WORLD_HEIGHT - 88);
}
for (let y = 60; y < WORLD_HEIGHT - 88; y += 70) {
  createTree(0, y);
  createTree(WORLD_WIDTH - 64, y);
}

// Gugusan pohon dan bebatuan alami di dalam peta
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
// 4. SPAWN PEMAIN UTAMA (MAIN PLAYER)
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

// Posisikan kamera instan di posisi pemain saat start
camera.follow(400, 350, true);

// ============================================================================
// 5. SPAWN BOT PEMAIN LAIN (SIMULATED PLAYERS)
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

createBotPlayer(470, 360, 'Valkyrie', 'Swordmaster', 3, '#58a6ff', '#1f6feb');
createBotPlayer(530, 320, 'ShadowBlade', 'Shadow Rogue', 4, '#bc8cff', '#6e40c9');
createBotPlayer(340, 390, 'Merlin', 'Archmage', 3, '#7ee787', '#238636');
createBotPlayer(370, 310, 'HealerKun', 'Cleric', 2, '#f0883e', '#bd561d');

// ============================================================================
// 6. SPAWN MONSTER & WORLD BOSS
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
      exp: isBoss ? 400 : 25 + level * 15,
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

// Forest Slimes (Level 1 - 2) di dekat spawn
createMonster(620, 320, 'Forest Slime', 1, 'slime', '#3fb950');
createMonster(680, 260, 'Forest Slime', 1, 'slime', '#3fb950');
createMonster(720, 380, 'Green Ooze', 2, 'slime', '#2ea043');
createMonster(800, 310, 'Green Ooze', 2, 'slime', '#2ea043');

// Forest Goblins (Level 3 - 4) di Lembah Goblin
createMonster(1080, 520, 'Goblin Scout', 3, 'goblin', '#d29922');
createMonster(1160, 580, 'Goblin Raider', 3, 'goblin', '#bf8700');
createMonster(1240, 500, 'Goblin Berserker', 4, 'goblin', '#9e6a03');

// Dire Wolves (Level 4 - 5) di Hutan Serigala
createMonster(1540, 280, 'Timber Wolf', 4, 'wolf', '#8b949e');
createMonster(1620, 350, 'Dire Wolf', 5, 'wolf', '#6e7681');
createMonster(1700, 290, 'Dire Wolf Alpha', 5, 'wolf', '#545d68');

// World Boss: Alpha Wolf Fenrir (Level 7)
createMonster(1950, 680, 'Alpha Wolf Fenrir', 7, 'boss', '#8957e5', 54, 54);

// ============================================================================
// 7. GAME LOOP & INTERAKSI INPUT
// ============================================================================

/**
 * Mencari monster terdekat dengan target position dalam radius tertentu.
 */
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

// Inisialisasi GameLoop deterministik
const loop = new GameLoop({
  update: (fixedDt: number) => {
    const playerTrans = world.getComponent(player, TransformComponent);
    const playerVel = world.getComponent(player, VelocityComponent);
    const playerStats = world.getComponent(player, StatsComponent);
    const playerCombat = world.getComponent(player, CombatComponent);

    // 1. Kontrol Pergerakan Pemain (WASD / Arrows)
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

      // 2. Aksi Tempur: Basic Attack (Space / J)
      if (input.isActionJustPressed('attack') && playerCombat) {
        playerCombat.isAttacking = true;
        const target = findNearestMonster(playerTrans.x + 16, playerTrans.y + 16, playerCombat.attackRange + 12);
        if (target) {
          combatSystem.executeBasicAttack(world, player, target.entity);
        }
      }

      // 3. Aksi Tempur: Whirlwind Slash Skill (K / 1)
      if (input.isActionJustPressed('skill') && playerCombat) {
        const target = findNearestMonster(playerTrans.x + 16, playerTrans.y + 16, playerCombat.skillRange);
        if (target) {
          combatSystem.executeSkill(world, player, target.entity);
        } else if (playerStats.mp >= playerCombat.skillCostMp && playerCombat.currentSkillCooldown <= 0) {
          // Whirlwind kosong
          playerStats.mp -= playerCombat.skillCostMp;
          playerCombat.currentSkillCooldown = playerCombat.skillCooldown;
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

      // 4. Minum Potion (Q = HP, E = MP)
      if (input.isActionJustPressed('potionHp')) {
        if (combatSystem.useHpPotion(playerStats)) {
          combatSystem.spawnFloatingText(world, playerTrans.x + 6, playerTrans.y - 14, '+50 HP', '#3fb950', false);
        }
      }
      if (input.isActionJustPressed('potionMp')) {
        if (combatSystem.useMpPotion(playerStats)) {
          combatSystem.spawnFloatingText(world, playerTrans.x + 6, playerTrans.y - 14, '+35 MP', '#1f6feb', false);
        }
      }
    }

    // 5. Update Sistem AI Monster & Bot MMO
    monsterAISystem.update(world, fixedDt);
    simulatedPlayerSystem.update(world, fixedDt);

    // 6. Update Pergerakan Fisika Top-Down (Sliding Collisions)
    topDownMovementSystem.update(world, fixedDt);

    // 7. Update Cooldown & Floating Text Combat
    combatSystem.update(world, fixedDt);

    // 8. Evaluasi Kematian Monster, Pemberian Hadiah & Jadwal Respawn
    const monsterEntities = world.query(MonsterAIComponent, StatsComponent, TransformComponent);
    for (const m of monsterEntities) {
      const mStats = world.getComponent(m, StatsComponent);
      const mTrans = world.getComponent(m, TransformComponent);
      const mPlate = world.getComponent(m, NameplateComponent);
      const mAi = world.getComponent(m, MonsterAIComponent);

      if (mStats && mTrans && mStats.hp <= 0 && mAi) {
        // Monster tewas: Beri reward ke player jika dekat
        if (playerTrans && playerStats) {
          const distToPlayer = Math.hypot(mTrans.x - playerTrans.x, mTrans.y - playerTrans.y);
          if (distToPlayer <= 280) {
            const expGained = mStats.exp > 0 ? mStats.exp : 30;
            const goldGained = mStats.gold > 0 ? mStats.gold : 20;

            playerStats.gold += goldGained;
            combatSystem.rewardExp(world, player, expGained);

            chatManager.addMessage(
              'Combat',
              `You defeated ${mPlate?.name ?? 'Monster'}! (+${expGained} EXP, +${goldGained} G)`,
              'system'
            );
          }
        }

        // Catat untuk respawn setelah 5 detik
        deadMonsters.push({
          entity: m,
          respawnTimer: 5.0,
          homeX: mAi.homeX,
          homeY: mAi.homeY,
          maxHp: mStats.maxHp,
        });

        // Pindahkan monster jauh ke luar pandangan sementara waktu
        mTrans.x = -9999;
        mTrans.y = -9999;
        mTrans.prevX = -9999;
        mTrans.prevY = -9999;
      }
    }

    // 9. Proses Timer Respawn Monster
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

    // 10. Kamera Mengikuti Pemain Utama
    if (playerTrans) {
      camera.follow(playerTrans.x + 16, playerTrans.y + 16);
    }

    // Akhiri frame input
    input.endFrame();
  },

  render: (alpha: number) => {
    // Render dunia top-down, depth sorting, dan HUD
    mmoRenderSystem.render(world, alpha, player);

    // Update metrik ke dashboard HTML
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
