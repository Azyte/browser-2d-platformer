import type { Entity } from '../ecs/Entity';
import type { World } from '../ecs/World';
import type { System } from '../ecs/System';
import type { Camera2D } from '../render/Camera2D';
import { TransformComponent } from '../physics/TransformComponent';
import {
  StatsComponent,
  CombatComponent,
  NameplateComponent,
  MonsterAIComponent,
  FloatingTextComponent,
} from './RPGComponents';
import type { ChatManager } from './ChatSystem';

export type MMOVisualType =
  | 'player'
  | 'bot'
  | 'slime'
  | 'goblin'
  | 'wolf'
  | 'boss'
  | 'tree'
  | 'rock'
  | 'water'
  | 'campfire';

export interface MMOVisualOptions {
  width?: number;
  height?: number;
  visualType?: MMOVisualType;
  color?: string;
  secondaryColor?: string;
  label?: string;
}

/**
 * MMOVisualComponent menentukan representasi visual entitas di dunia MMORPG 2D.
 */
export class MMOVisualComponent {
  public width: number;
  public height: number;
  public visualType: MMOVisualType;
  public color?: string;
  public secondaryColor?: string;
  public label?: string;

  constructor(options?: MMOVisualOptions) {
    this.width = options?.width ?? 32;
    this.height = options?.height ?? 32;
    this.visualType = options?.visualType ?? 'player';
    this.color = options?.color;
    this.secondaryColor = options?.secondaryColor;
    this.label = options?.label;
  }
}

export interface DepthSortable {
  entity: Entity;
  baseY: number;
}

/**
 * Mengurutkan entitas secara ascending berdasarkan posisi Y terbawah (kaki/alas).
 * Digunakan untuk depth sorting (Z-ordering top-down 2.5D).
 * @param world ECS World
 * @param entities Daftar entitas yang akan diurutkan
 * @param alpha Faktor interpolasi render antara fixed steps (0.0 sampai 1.0)
 */
export function sortEntitiesByDepth(
  world: World,
  entities: Entity[],
  alpha: number = 1.0
): Entity[] {
  const items: DepthSortable[] = [];

  for (const entity of entities) {
    const transform = world.getComponent(entity, TransformComponent);
    const visual = world.getComponent(entity, MMOVisualComponent);
    if (!transform) continue;

    const height = visual?.height ?? 32;
    const interpolatedY = transform.prevY + (transform.y - transform.prevY) * alpha;
    const baseY = interpolatedY + height;

    items.push({ entity, baseY });
  }

  items.sort((a, b) => a.baseY - b.baseY);
  return items.map((item) => item.entity);
}

/**
 * Menghitung lebar bar HP secara proporsional dengan clamping aman antara 0 dan maxWidth.
 */
export function calculateHealthBarWidth(hp: number, maxHp: number, maxWidth: number): number {
  if (maxHp <= 0) return 0;
  const clampedHp = Math.max(0, Math.min(hp, maxHp));
  return Math.round((clampedHp / maxHp) * maxWidth);
}

/**
 * Memformat timestamp pesan chat ke dalam format HH:MM.
 */
export function formatChatTimestamp(date: Date | string): string {
  if (typeof date === 'string') {
    return date.length > 5 ? date.slice(0, 5) : date;
  }
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * MMORenderSystem merender dunia MMORPG 2D top-down:
 * - Tilemap latar belakang (rumput berpola, jalan setapak, danau)
 * - Entitas berkedalaman (Depth Y-Sorting) sehingga karakter dapat berjalan di belakang atau depan pohon
 * - Karakter dengan animasi ayunan pedang dan visual skill whirlwind
 * - Overhead Nameplate dan Mini HP Bar
 * - Teks Floating Damage / EXP / Level Up
 * - Antarmuka Pengguna (HUD): Status Pemain (HP/MP/EXP/Gold), Hotbar Skill/Potion, dan Global Chat Log
 */
export class MMORenderSystem implements System {
  public visibleEntitiesCount: number = 0;
  private animTimer: number = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly camera: Camera2D,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly chatManager?: ChatManager
  ) {}

  /**
   * Siklus render utama yang dipanggil oleh GameLoop pada requestAnimationFrame.
   */
  public render(world: World, alpha: number, mainPlayerEntity?: Entity | null): void {
    const ctx = this.ctx;
    const cam = this.camera;
    this.animTimer += 0.016;

    // Bersihkan canvas
    ctx.fillStyle = '#0b130e';
    ctx.fillRect(0, 0, cam.viewportWidth, cam.viewportHeight);

    ctx.save();
    // Translasi kamera viewport
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    // 1. Gambar Terrain & Lingkungan Dunia
    this.renderTerrain(ctx, cam);

    // 2. Kumpulkan entitas visual dan urutkan dengan Depth Y-Sorting
    const allVisualEntities = world.query(TransformComponent, MMOVisualComponent);
    const visibleEntities: Entity[] = [];

    for (const entity of allVisualEntities) {
      const transform = world.getComponent(entity, TransformComponent);
      const visual = world.getComponent(entity, MMOVisualComponent);
      if (!transform || !visual) continue;

      const renderX = transform.prevX + (transform.x - transform.prevX) * alpha;
      const renderY = transform.prevY + (transform.y - transform.prevY) * alpha;

      if (cam.isVisible(renderX - 20, renderY - 30, visual.width + 40, visual.height + 50)) {
        visibleEntities.push(entity);
      }
    }

    this.visibleEntitiesCount = visibleEntities.length;
    const sortedEntities = sortEntitiesByDepth(world, visibleEntities, alpha);

    // 3. Render entitas sesuai urutan kedalaman (dari belakang ke depan)
    for (const entity of sortedEntities) {
      const transform = world.getComponent(entity, TransformComponent);
      const visual = world.getComponent(entity, MMOVisualComponent);
      const stats = world.getComponent(entity, StatsComponent);
      const nameplate = world.getComponent(entity, NameplateComponent);
      const combat = world.getComponent(entity, CombatComponent);
      const ai = world.getComponent(entity, MonsterAIComponent);

      if (!transform || !visual) continue;

      const rx = transform.prevX + (transform.x - transform.prevX) * alpha;
      const ry = transform.prevY + (transform.y - transform.prevY) * alpha;

      // Gambar bayangan di bawah kaki entitas
      this.renderEntityShadow(ctx, rx, ry, visual.width, visual.height);

      // Gambar sprite objek atau karakter
      this.renderEntitySprite(ctx, entity, rx, ry, visual, combat);

      // Gambar efek visual serangan (Slash / Whirlwind) jika sedang aktif
      if (combat) {
        this.renderCombatEffects(ctx, rx, ry, visual, combat);
      }

      // Gambar Overhead Nameplate & Mini HP Bar
      if (nameplate && stats) {
        this.renderNameplate(ctx, rx, ry, visual, nameplate, stats, ai);
      }
    }

    // 4. Render Floating Damage Text di atas segalanya di koordinat dunia
    this.renderFloatingTexts(world, ctx, cam, alpha);

    ctx.restore();

    // 5. Render HUD Statis di Layar Browser (Screen Space)
    this.renderHUD(ctx, world, mainPlayerEntity);
  }

  /**
   * Merender ubin tanah (rumput alami, jalan setapak batu kerikil, sungai/danau).
   */
  private renderTerrain(ctx: CanvasRenderingContext2D, cam: Camera2D): void {
    const tileSize = 64;
    const startX = Math.floor(cam.x / tileSize) * tileSize;
    const endX = Math.min(this.worldWidth, cam.x + cam.viewportWidth + tileSize);
    const startY = Math.floor(cam.y / tileSize) * tileSize;
    const endY = Math.min(this.worldHeight, cam.y + cam.viewportHeight + tileSize);

    for (let x = startX; x <= endX; x += tileSize) {
      for (let y = startY; y <= endY; y += tileSize) {
        // Pola rumput berpola kotak subtle
        const tileHash = (x * 73856093) ^ (y * 19349663);
        const isAlternate = (Math.abs(tileHash) % 3) === 0;

        ctx.fillStyle = isAlternate ? '#1a3320' : '#142819';
        ctx.fillRect(x, y, tileSize, tileSize);

        // Rumput dekoratif kecil
        if ((Math.abs(tileHash) % 7) === 0) {
          ctx.fillStyle = '#2d5a37';
          ctx.fillRect(x + 16, y + 24, 3, 6);
          ctx.fillRect(x + 20, y + 22, 3, 8);
          ctx.fillRect(x + 24, y + 25, 3, 5);
        } else if ((Math.abs(tileHash) % 11) === 0) {
          // Bunga kecil padang rumput
          ctx.fillStyle = '#f0c674';
          ctx.fillRect(x + 38, y + 36, 4, 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 36, y + 36, 2, 4);
          ctx.fillRect(x + 42, y + 36, 2, 4);
        }
      }
    }

    // Gambar jalan setapak cobblestone melintasi peta
    ctx.fillStyle = '#3a3429';
    const roadY = 320;
    const roadHeight = 70;
    if (cam.y + cam.viewportHeight >= roadY && cam.y <= roadY + roadHeight) {
      ctx.fillRect(0, roadY, this.worldWidth, roadHeight);
      ctx.strokeStyle = '#524b3c';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, roadY, this.worldWidth, roadHeight);

      // Detail batu jalan setapak
      ctx.fillStyle = '#473f32';
      for (let rx = 20; rx < this.worldWidth; rx += 48) {
        ctx.fillRect(rx, roadY + 12, 28, 18);
        ctx.fillRect(rx + 24, roadY + 38, 22, 16);
      }
    }

    // Kolam air / danau di sisi timur
    const lakeX = 1400;
    const lakeY = 460;
    const lakeW = 280;
    const lakeH = 180;
    if (cam.isVisible(lakeX, lakeY, lakeW, lakeH)) {
      ctx.fillStyle = '#10304a';
      ctx.beginPath();
      ctx.ellipse(
        lakeX + lakeW / 2,
        lakeY + lakeH / 2,
        lakeW / 2,
        lakeH / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Riak air animasi
      const rippleWave = Math.sin(this.animTimer * 2) * 6;
      ctx.strokeStyle = '#2d6d9c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(
        lakeX + lakeW / 2,
        lakeY + lakeH / 2,
        lakeW / 2 - 20 + rippleWave,
        lakeH / 2 - 20,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    // Batas tepi dunia
    ctx.strokeStyle = '#ff7b72';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);
  }

  /**
   * Bayangan oval halus di bawah kaki karakter atau objek.
   */
  private renderEntityShadow(
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(rx + w / 2, ry + h - 2, w * 0.45, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Merender sprite entitas sesuai visualType.
   */
  private renderEntitySprite(
    ctx: CanvasRenderingContext2D,
    _entity: Entity,
    rx: number,
    ry: number,
    visual: MMOVisualComponent,
    _combat: CombatComponent | undefined
  ): void {
    ctx.save();

    switch (visual.visualType) {
      case 'tree': {
        // Batang pohon cokelat
        ctx.fillStyle = '#4a2f13';
        ctx.fillRect(rx + visual.width * 0.38, ry + visual.height * 0.55, visual.width * 0.24, visual.height * 0.45);

        // Kanopi daun rimbun hijau berlapis
        ctx.fillStyle = '#1e5e29';
        ctx.beginPath();
        ctx.arc(rx + visual.width / 2, ry + visual.height * 0.35, visual.width * 0.46, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#297c38';
        ctx.beginPath();
        ctx.arc(rx + visual.width / 2 - 4, ry + visual.height * 0.32, visual.width * 0.38, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3eb555';
        ctx.beginPath();
        ctx.arc(rx + visual.width / 2 - 8, ry + visual.height * 0.26, visual.width * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'rock': {
        // Bebatuan granit abu-abu
        ctx.fillStyle = '#484f58';
        ctx.beginPath();
        ctx.roundRect(rx, ry + 6, visual.width, visual.height - 6, 8);
        ctx.fill();

        ctx.fillStyle = '#6e7681';
        ctx.beginPath();
        ctx.roundRect(rx + 4, ry + 8, visual.width - 8, (visual.height - 6) * 0.45, 4);
        ctx.fill();
        break;
      }

      case 'slime': {
        // Slime jeli memantul
        const bounce = Math.abs(Math.sin(this.animTimer * 4)) * 3;
        const color = visual.color ?? '#3fb950';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(
          rx + visual.width / 2,
          ry + visual.height / 2 + bounce / 2,
          visual.width * 0.45,
          visual.height * 0.4 - bounce / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Mata slime
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rx + visual.width / 2 - 5, ry + visual.height / 2 - 2, 3, 0, Math.PI * 2);
        ctx.arc(rx + visual.width / 2 + 5, ry + visual.height / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f2913';
        ctx.beginPath();
        ctx.arc(rx + visual.width / 2 - 4, ry + visual.height / 2 - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(rx + visual.width / 2 + 6, ry + visual.height / 2 - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'goblin': {
        // Monster Goblin bersenjata pisau
        const skinColor = visual.color ?? '#bf8700';
        ctx.fillStyle = skinColor;
        ctx.fillRect(rx + 6, ry + 4, visual.width - 12, visual.height - 8);

        // Telinga goblin runcing
        ctx.beginPath();
        ctx.moveTo(rx + 6, ry + 8);
        ctx.lineTo(rx + 1, ry + 12);
        ctx.lineTo(rx + 6, ry + 16);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(rx + visual.width - 6, ry + 8);
        ctx.lineTo(rx + visual.width - 1, ry + 12);
        ctx.lineTo(rx + visual.width - 6, ry + 16);
        ctx.fill();

        // Rompi kulit
        ctx.fillStyle = '#5c3d11';
        ctx.fillRect(rx + 8, ry + 14, visual.width - 16, visual.height - 18);
        break;
      }

      case 'wolf': {
        // Serigala hutan buas
        ctx.fillStyle = visual.color ?? '#6e7681';
        ctx.beginPath();
        ctx.roundRect(rx + 2, ry + 6, visual.width - 4, visual.height - 10, 6);
        ctx.fill();

        // Mata serigala menyala merah
        ctx.fillStyle = '#ff7b72';
        ctx.fillRect(rx + visual.width - 10, ry + 10, 3, 3);
        ctx.fillRect(rx + visual.width - 16, ry + 10, 3, 3);
        break;
      }

      case 'boss': {
        // Boss Monster (Golem / Raksasa)
        const bossColor = visual.color ?? '#8957e5';
        ctx.fillStyle = bossColor;
        ctx.beginPath();
        ctx.roundRect(rx, ry, visual.width, visual.height, 10);
        ctx.fill();

        // Rune magis bercahaya di dada boss
        ctx.strokeStyle = '#d2a8ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx + 12, ry + 14, visual.width - 24, visual.height - 28);

        // Tanduk mahkota boss
        ctx.fillStyle = '#f0883e';
        ctx.beginPath();
        ctx.moveTo(rx + 10, ry);
        ctx.lineTo(rx + 16, ry - 10);
        ctx.lineTo(rx + 22, ry);
        ctx.lineTo(rx + visual.width - 22, ry);
        ctx.lineTo(rx + visual.width - 16, ry - 10);
        ctx.lineTo(rx + visual.width - 10, ry);
        ctx.fill();
        break;
      }

      case 'bot': {
        // Bot pemain lain dengan jubah kelas
        const armorColor = visual.color ?? '#58a6ff';
        const capeColor = visual.secondaryColor ?? '#1f6feb';

        // Jubah
        ctx.fillStyle = capeColor;
        ctx.fillRect(rx + 4, ry + 8, visual.width - 8, visual.height - 10);

        // Bodi karakter
        ctx.fillStyle = armorColor;
        ctx.fillRect(rx + 6, ry + 4, visual.width - 12, visual.height - 10);

        // Helm/Wajah
        ctx.fillStyle = '#ffdfba';
        ctx.fillRect(rx + 9, ry + 7, visual.width - 18, 9);
        break;
      }

      case 'player':
      default: {
        // Pemain utama: Hero Knight berbaju zirah hijau/emas
        const mainColor = visual.color ?? '#3fb950';

        // Tubuh / Armor
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.roundRect(rx + 4, ry + 6, visual.width - 8, visual.height - 10, 4);
        ctx.fill();

        // Sabuk kulit emas
        ctx.fillStyle = '#d29922';
        ctx.fillRect(rx + 5, ry + visual.height * 0.58, visual.width - 10, 4);

        // Wajah
        ctx.fillStyle = '#ffe0bd';
        ctx.fillRect(rx + 8, ry + 8, visual.width - 16, 9);

        // Rambut/Helm
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(rx + 7, ry + 5, visual.width - 14, 5);

        // Pedang di sisi tubuh
        ctx.fillStyle = '#c9d1d9';
        ctx.fillRect(rx + visual.width - 5, ry + 10, 4, 16);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(rx + visual.width - 7, ry + 16, 8, 3);
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Menampilkan visual effect tebasan pedang (Basic Attack) dan pusaran angin (Whirlwind Slash).
   */
  private renderCombatEffects(
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    visual: MMOVisualComponent,
    combat: CombatComponent
  ): void {
    const centerX = rx + visual.width / 2;
    const centerY = ry + visual.height / 2;

    // Visual Whirlwind Slash saat cooldown baru saja terpicu (aktif selama 0.3 detik pertama)
    if (combat.currentSkillCooldown > combat.skillCooldown - 0.3) {
      const radius = combat.skillRange * 0.9;
      ctx.save();
      ctx.strokeStyle = '#bc8cff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Blade streaks
      ctx.strokeStyle = '#e3b341';
      ctx.lineWidth = 2.5;
      const spinAngle = this.animTimer * 18;
      for (let i = 0; i < 3; i++) {
        const a = spinAngle + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.75, a, a + 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Visual Basic Attack Slash saat menyerang
    if (combat.isAttacking || combat.currentAttackCooldown > combat.attackCooldown - 0.15) {
      ctx.save();
      ctx.strokeStyle = '#f0883e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX + 12, centerY, 20, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Menampilkan Nameplate overhead: Nama, Level, dan Mini Health Bar.
   */
  private renderNameplate(
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    visual: MMOVisualComponent,
    nameplate: NameplateComponent,
    stats: StatsComponent,
    ai?: MonsterAIComponent
  ): void {
    const centerX = rx + visual.width / 2;
    const plateY = ry - 14;

    ctx.save();
    ctx.textAlign = 'center';

    // 1. Teks Nama dan Level
    ctx.font = '10px monospace';
    let nameColor = '#ff7b72';
    if (nameplate.role === 'player') {
      nameColor = '#58a6ff';
    } else if (nameplate.role === 'other_player') {
      nameColor = '#79c0ff';
    } else if (nameplate.role === 'monster' && stats.level >= 5) {
      nameColor = '#f0883e'; // Mini-boss / high level
    }

    let statusTag = '';
    if (ai && ai.state === 'return') {
      statusTag = ' (Returning)';
      nameColor = '#3fb950';
    }

    const titleText = nameplate.title ? `<${nameplate.title}> ` : '';
    const label = `${titleText}[Lv.${stats.level}] ${nameplate.name}${statusTag}`;

    // Outline gelap agar terbaca jelas di segala latar
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(label, centerX, plateY);

    ctx.fillStyle = nameColor;
    ctx.fillText(label, centerX, plateY);

    // 2. Mini Health Bar
    if (nameplate.showHealthBar) {
      const barWidth = 38;
      const barHeight = 4;
      const barX = centerX - barWidth / 2;
      const barY = plateY + 3;

      // Background hitam/merah tua
      ctx.fillStyle = '#301818';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Bar darah hijau/kuning
      const currentFill = calculateHealthBarWidth(stats.hp, stats.maxHp, barWidth);
      ctx.fillStyle = stats.hp / stats.maxHp > 0.3 ? '#3fb950' : '#f85149';
      ctx.fillRect(barX, barY, currentFill, barHeight);

      // Border tipis
      ctx.strokeStyle = '#0d1117';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    ctx.restore();
  }

  /**
   * Merender seluruh teks damage floating di layar dengan translasi kamera.
   */
  private renderFloatingTexts(
    world: World,
    ctx: CanvasRenderingContext2D,
    cam: Camera2D,
    alpha: number
  ): void {
    const floatingEntities = world.query(TransformComponent, FloatingTextComponent);

    for (const entity of floatingEntities) {
      const transform = world.getComponent(entity, TransformComponent);
      const textComp = world.getComponent(entity, FloatingTextComponent);
      if (!transform || !textComp) continue;

      const rx = transform.prevX + (transform.x - transform.prevX) * alpha;
      const ry = transform.prevY + (transform.y - transform.prevY) * alpha;

      if (!cam.isVisible(rx - 50, ry - 20, 100, 40)) continue;

      // Hitung alpha pudar berdasarkan sisa lifetime
      const lifeRatio = 1.0 - textComp.elapsed / textComp.lifetime;
      const fadeAlpha = Math.max(0, Math.min(1, lifeRatio));

      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.textAlign = 'center';
      ctx.font = textComp.isCrit ? 'bold 13px monospace' : '11px monospace';

      // Outline hitam
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = textComp.isCrit ? 3.5 : 2.5;
      ctx.strokeText(textComp.text, rx, ry);

      // Warna teks
      ctx.fillStyle = textComp.color;
      ctx.fillText(textComp.text, rx, ry);

      ctx.restore();
    }
  }

  /**
   * Merender Antarmuka Pengguna (HUD) MMORPG di atas layar browser (Screen Space).
   */
  private renderHUD(
    ctx: CanvasRenderingContext2D,
    world: World,
    mainPlayerEntity?: Entity | null
  ): void {
    const vw = this.camera.viewportWidth;
    const vh = this.camera.viewportHeight;

    ctx.save();

    // 1. Panel Stat Pemain Utama di Kiri Atas
    if (mainPlayerEntity) {
      const stats = world.getComponent(mainPlayerEntity, StatsComponent);
      const nameplate = world.getComponent(mainPlayerEntity, NameplateComponent);
      const combat = world.getComponent(mainPlayerEntity, CombatComponent);

      if (stats) {
        this.renderPlayerHUDPanel(ctx, 14, 14, nameplate?.name ?? 'Hero', stats);
      }

      // 2. Action Hotbar di Tengah Bawah
      if (combat && stats) {
        this.renderActionBar(ctx, vw / 2 - 140, vh - 48, combat, stats);
      }
    }

    // 3. Mini Info Wilayah di Kanan Atas
    this.renderWorldInfo(ctx, vw - 210, 14);

    // 4. Global MMO Chat Log di Kiri Bawah
    if (this.chatManager) {
      this.renderChatBox(ctx, 14, vh - 134, 270, 80);
    }

    ctx.restore();
  }

  /**
   * Panel Profil Pemain: HP, MP, EXP, dan Gold.
   */
  private renderPlayerHUDPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    name: string,
    stats: StatsComponent
  ): void {
    const w = 210;
    const h = 76;

    // Background kotak kaca gelap
    ctx.fillStyle = 'rgba(13, 17, 23, 0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Header Nama, Level, dan Gold
    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${name} (Lv.${stats.level})`, x + 8, y + 16);

    ctx.fillStyle = '#e3b341';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`💰 ${stats.gold} G`, x + w - 8, y + 16);

    const barW = w - 16;
    const barX = x + 8;

    // HP Bar (Merah / Hijau)
    const hpY = y + 23;
    ctx.fillStyle = '#21262d';
    ctx.fillRect(barX, hpY, barW, 11);
    const hpWidth = calculateHealthBarWidth(stats.hp, stats.maxHp, barW);
    ctx.fillStyle = '#da3633';
    ctx.fillRect(barX, hpY, hpWidth, 11);
    ctx.strokeStyle = '#484f58';
    ctx.strokeRect(barX, hpY, barW, 11);

    ctx.fillStyle = '#ffffff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HP ${stats.hp}/${stats.maxHp}`, barX + barW / 2, hpY + 9);

    // MP Bar (Biru)
    const mpY = y + 38;
    ctx.fillStyle = '#21262d';
    ctx.fillRect(barX, mpY, barW, 11);
    const mpWidth = calculateHealthBarWidth(stats.mp, stats.maxMp, barW);
    ctx.fillStyle = '#1f6feb';
    ctx.fillRect(barX, mpY, mpWidth, 11);
    ctx.strokeStyle = '#484f58';
    ctx.strokeRect(barX, mpY, barW, 11);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`MP ${stats.mp}/${stats.maxMp}`, barX + barW / 2, mpY + 9);

    // EXP Bar (Emas)
    const expY = y + 53;
    ctx.fillStyle = '#21262d';
    ctx.fillRect(barX, expY, barW, 9);
    const expWidth = calculateHealthBarWidth(stats.exp, stats.nextLevelExp, barW);
    ctx.fillStyle = '#9e6a03';
    ctx.fillRect(barX, expY, expWidth, 9);
    ctx.strokeStyle = '#484f58';
    ctx.strokeRect(barX, expY, barW, 9);

    const expPct = Math.round((stats.exp / stats.nextLevelExp) * 100);
    ctx.fillStyle = '#f0c674';
    ctx.fillText(`EXP ${expPct}%`, barX + barW / 2, expY + 8);
  }

  /**
   * Action Hotbar: Serangan, Whirlwind Slash, HP Potion, dan MP Potion.
   */
  private renderActionBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    combat: CombatComponent,
    stats: StatsComponent
  ): void {
    const slots = [
      { key: 'SPC/J', label: 'Attack', cd: combat.currentAttackCooldown, maxCd: combat.attackCooldown, count: null },
      { key: 'K / 1', label: 'Slash', cd: combat.currentSkillCooldown, maxCd: combat.skillCooldown, count: null },
      { key: 'Q', label: 'HP Pot', cd: 0, maxCd: 1, count: stats.hpPotions },
      { key: 'E', label: 'MP Pot', cd: 0, maxCd: 1, count: stats.mpPotions },
    ];

    const slotSize = 42;
    const gap = 8;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sx = x + i * (slotSize + gap);

      // Box
      ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
      ctx.fillRect(sx, y, slotSize, slotSize);
      ctx.strokeStyle = slot.cd > 0 ? '#484f58' : '#58a6ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, y, slotSize, slotSize);

      // Label tombol
      ctx.fillStyle = '#79c0ff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(slot.key, sx + 3, y + 10);

      // Nama aksi
      ctx.fillStyle = '#e6edf3';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(slot.label, sx + slotSize / 2, y + 26);

      // Potion count
      if (slot.count !== null) {
        ctx.fillStyle = '#3fb950';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`x${slot.count}`, sx + slotSize - 3, y + slotSize - 4);
      }

      // Cooldown overlay
      if (slot.cd > 0) {
        const cdHeight = (slot.cd / slot.maxCd) * slotSize;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(sx, y + slotSize - cdHeight, slotSize, cdHeight);

        ctx.fillStyle = '#f85149';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(slot.cd.toFixed(1), sx + slotSize / 2, y + slotSize / 2 + 3);
      }
    }
  }

  /**
   * Info Wilayah dan Online Status di Kanan Atas.
   */
  private renderWorldInfo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const w = 196;
    const h = 42;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.textAlign = 'left';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#3fb950';
    ctx.fillText('🌲 Emerald Sanctuary [CH 1]', x + 8, y + 16);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('🟢 5 Adventurers Online', x + 8, y + 32);
  }

  /**
   * Global MMO Chat Box di Kiri Bawah.
   */
  private renderChatBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    if (!this.chatManager) return;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Chat Header
    ctx.fillStyle = '#8b949e';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('💬 Global MMO Chat', x + 6, y + 12);

    const messages = this.chatManager.getMessages();
    const displayMessages = messages.slice(-4);
    let lineY = y + 25;

    for (const msg of displayMessages) {
      let channelColor = '#58a6ff';
      if (msg.role === 'system') channelColor = '#d29922';
      if (msg.role === 'player') channelColor = '#3fb950';

      ctx.font = '9px monospace';
      ctx.textAlign = 'left';

      const timeStr = formatChatTimestamp(msg.timestamp);
      ctx.fillStyle = '#484f58';
      ctx.fillText(`[${timeStr}]`, x + 6, lineY);

      ctx.fillStyle = channelColor;
      const senderText = msg.sender ? `[${msg.sender}]: ` : '';
      ctx.fillText(`${senderText}${msg.text}`, x + 50, lineY);

      lineY += 13;
    }
  }
}
