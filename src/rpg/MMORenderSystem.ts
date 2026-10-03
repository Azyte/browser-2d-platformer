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
import type { QuestManager } from './QuestSystem';
import { NPCComponent, type NPCSystem } from './NPCSystem';
import { InventoryComponent } from './InventorySystem';
import type { DayNightSystem, LightSource } from './DayNightSystem';
import { SimulatedPlayerComponent } from './RPGComponents';

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
  | 'campfire'
  | 'npc';

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
 * - Tilemap latar belakang (rumput alami, jalan setapak batu, kolam air beriak)
 * - Depth Y-Sorting: Karakter dan monster dapat berjalan di depan atau belakang pohon/batu
 * - Visual detail untuk setiap kelas karakter (Hero Knight, Valkyrie, ShadowBlade, Merlin, HealerKun)
 * - Visual unik untuk setiap monster (Slime kenyal, Goblin bersenjata, Serigala buas, World Boss Fenrir)
 * - Efek jarahan loot drop berkerlap-kerlip
 * - Minimap Radar navigasi di sudut kanan atas
 * - HUD MMORPG: Panel profil pemain, bar aksi hotbar, pelacak Quest aktif, dan Global Chat Log
 */
export class MMORenderSystem implements System {
  public visibleEntitiesCount: number = 0;
  private animTimer: number = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly camera: Camera2D,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly chatManager?: ChatManager,
    private readonly questManager?: QuestManager,
    private readonly npcSystem?: NPCSystem,
    private readonly dayNightSystem?: DayNightSystem
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

      if (cam.isVisible(renderX - 25, renderY - 35, visual.width + 50, visual.height + 60)) {
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

      // Gambar bayangan halus di bawah kaki
      this.renderEntityShadow(ctx, rx, ry, visual.width, visual.height);

      // Gambar sprite objek atau karakter dengan visual khusus
      this.renderEntitySprite(ctx, entity, rx, ry, visual, nameplate, stats);

      // Efek tebasan / whirlwind saat menyerang
      if (combat) {
        this.renderCombatEffects(ctx, rx, ry, visual, combat);
      }

      // Overhead Nameplate & Mini HP Bar
      if (nameplate && stats) {
        this.renderNameplate(ctx, rx, ry, visual, nameplate, stats, ai);
      }
    }

    // 4. Render Floating Damage Text di koordinat dunia
    this.renderFloatingTexts(world, ctx, cam, alpha);

    // 4b. Overhead Prompt Interaksi NPC terdekat
    this.renderNPCInteractionPrompt(world, ctx);

    ctx.restore();

    // 4c. Render Radial Lighting (Malam, fajar, senja & lentera obor)
    if (this.dayNightSystem) {
      const lights = this.collectLightSources(world, mainPlayerEntity, alpha);
      this.dayNightSystem.renderLighting(ctx, cam, lights);
    }

    // 5. Render HUD Statis di Layar Browser (Screen Space)
    this.renderHUD(ctx, world, mainPlayerEntity);

    // 6. Render Overlays: Modal Dialog NPC & Modal Inventaris Tas
    if (this.npcSystem && this.npcSystem.isDialogueOpen) {
      this.renderDialogueModal(ctx, world);
    }

    if (mainPlayerEntity) {
      const inv = world.getComponent(mainPlayerEntity, InventoryComponent);
      const stats = world.getComponent(mainPlayerEntity, StatsComponent);
      if (inv && inv.isOpen && stats) {
        this.renderInventoryModal(ctx, inv, stats);
      }
    }
  }

  /**
   * Merender ubin tanah (rumput alami, jalan setapak batu, sungai/danau).
   */
  private renderTerrain(ctx: CanvasRenderingContext2D, cam: Camera2D): void {
    const tileSize = 64;
    const startX = Math.floor(cam.x / tileSize) * tileSize;
    const endX = Math.min(this.worldWidth, cam.x + cam.viewportWidth + tileSize);
    const startY = Math.floor(cam.y / tileSize) * tileSize;
    const endY = Math.min(this.worldHeight, cam.y + cam.viewportHeight + tileSize);

    for (let x = startX; x <= endX; x += tileSize) {
      for (let y = startY; y <= endY; y += tileSize) {
        const tileHash = (x * 73856093) ^ (y * 19349663);
        const isAlternate = (Math.abs(tileHash) % 3) === 0;

        ctx.fillStyle = isAlternate ? '#1a3320' : '#142819';
        ctx.fillRect(x, y, tileSize, tileSize);

        // Rumput dekoratif
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

    // Jalan setapak batu
    const roadY = 320;
    const roadHeight = 70;
    if (cam.y + cam.viewportHeight >= roadY && cam.y <= roadY + roadHeight) {
      ctx.fillStyle = '#3a3429';
      ctx.fillRect(0, roadY, this.worldWidth, roadHeight);
      ctx.strokeStyle = '#524b3c';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, roadY, this.worldWidth, roadHeight);

      ctx.fillStyle = '#473f32';
      for (let rx = 20; rx < this.worldWidth; rx += 48) {
        ctx.fillRect(rx, roadY + 12, 28, 18);
        ctx.fillRect(rx + 24, roadY + 38, 22, 16);
      }
    }

    // Danau air di sisi timur
    const lakeX = 1400;
    const lakeY = 460;
    const lakeW = 280;
    const lakeH = 180;
    if (cam.isVisible(lakeX, lakeY, lakeW, lakeH)) {
      ctx.fillStyle = '#10304a';
      ctx.beginPath();
      ctx.ellipse(lakeX + lakeW / 2, lakeY + lakeH / 2, lakeW / 2, lakeH / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Riak animasi air
      const rippleWave = Math.sin(this.animTimer * 2) * 6;
      ctx.strokeStyle = '#2d6d9c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(lakeX + lakeW / 2, lakeY + lakeH / 2, lakeW / 2 - 20 + rippleWave, lakeH / 2 - 20, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Batas tepi dunia game
    ctx.strokeStyle = '#ff7b72';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);
  }

  /**
   * Bayangan oval di bawah kaki entitas.
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
   * Merender representasi visual spesifik untuk tiap karakter, monster, dan item.
   */
  private renderEntitySprite(
    ctx: CanvasRenderingContext2D,
    _entity: Entity,
    rx: number,
    ry: number,
    visual: MMOVisualComponent,
    nameplate?: NameplateComponent,
    _stats?: StatsComponent
  ): void {
    ctx.save();
    const w = visual.width;
    const h = visual.height;
    const cx = rx + w / 2;
    const cy = ry + h / 2;

    switch (visual.visualType) {
      case 'tree': {
        // Batang pohon dengan tekstur serat kayu
        ctx.fillStyle = '#3d250f';
        ctx.fillRect(rx + w * 0.38, ry + h * 0.55, w * 0.24, h * 0.45);
        ctx.fillStyle = '#2a1807';
        ctx.fillRect(rx + w * 0.44, ry + h * 0.65, 3, h * 0.3);

        // Kanopi bertingkat 3 lapis
        ctx.fillStyle = '#14421b';
        ctx.beginPath();
        ctx.arc(cx, ry + h * 0.42, w * 0.48, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e5e29';
        ctx.beginPath();
        ctx.arc(cx - 2, ry + h * 0.32, w * 0.42, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2ea043';
        ctx.beginPath();
        ctx.arc(cx - 5, ry + h * 0.24, w * 0.28, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'rock': {
        // Bebatuan granit dengan lumut hijau di bagian atas
        ctx.fillStyle = '#484f58';
        ctx.beginPath();
        ctx.roundRect(rx, ry + 6, w, h - 6, 8);
        ctx.fill();

        ctx.fillStyle = '#6e7681';
        ctx.beginPath();
        ctx.roundRect(rx + 4, ry + 8, w - 8, (h - 6) * 0.4, 4);
        ctx.fill();

        // Lumut hijau
        ctx.fillStyle = '#2ea043';
        ctx.fillRect(rx + 8, ry + 7, 10, 4);
        ctx.fillRect(rx + 24, ry + 6, 12, 5);
        break;
      }

      case 'slime': {
        // Slime kenyal membal (squash and stretch)
        const bounce = Math.abs(Math.sin(this.animTimer * 5)) * 4;
        const color = visual.color ?? '#3fb950';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, cy + bounce / 2, w * 0.46, h * 0.4 - bounce / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inti inti sel jeli bercahaya
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + bounce / 2 + 2, w * 0.22, h * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mata anime lucu dengan kilauan
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 6, cy + bounce / 2 - 3, 3.5, 0, Math.PI * 2);
        ctx.arc(cx + 6, cy + bounce / 2 - 3, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f2913';
        ctx.beginPath();
        ctx.arc(cx - 5, cy + bounce / 2 - 3, 1.8, 0, Math.PI * 2);
        ctx.arc(cx + 7, cy + bounce / 2 - 3, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Kilau specular di kubah slime
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.ellipse(cx - 7, cy - h * 0.22 + bounce / 2, 4, 2, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'goblin': {
        // Goblin bersenjata kapak/pemukul kayu berduri
        const skinColor = visual.color ?? '#bf8700';
        ctx.fillStyle = skinColor;
        ctx.fillRect(rx + 6, ry + 4, w - 12, h - 8);

        // Telinga panjang runcing dengan anting emas
        ctx.beginPath();
        ctx.moveTo(rx + 6, ry + 8);
        ctx.lineTo(rx, ry + 12);
        ctx.lineTo(rx + 6, ry + 16);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(rx + w - 6, ry + 8);
        ctx.lineTo(rx + w, ry + 12);
        ctx.lineTo(rx + w - 6, ry + 16);
        ctx.fill();

        // Anting emas di telinga kiri
        ctx.fillStyle = '#f0c674';
        ctx.fillRect(rx + 1, ry + 14, 2, 3);

        // Rambut mohawk duri liar hitam
        ctx.fillStyle = '#161b22';
        ctx.beginPath();
        ctx.moveTo(rx + 10, ry + 4);
        ctx.lineTo(cx, ry - 3);
        ctx.lineTo(rx + w - 10, ry + 4);
        ctx.fill();

        // Rompi kulit cokelat dengan kalung taring
        ctx.fillStyle = '#5c3d11';
        ctx.fillRect(rx + 7, ry + 14, w - 14, h - 18);

        // Senjata: gada kayu berduri
        ctx.fillStyle = '#6e401f';
        ctx.fillRect(rx + w - 4, ry + 8, 4, 16);
        ctx.fillStyle = '#8b949e';
        ctx.fillRect(rx + w - 6, ry + 6, 8, 5);
        break;
      }

      case 'wolf': {
        // Serigala hutan berkaki empat dengan ekor lebat
        const coatColor = visual.color ?? '#6e7681';
        const tailWag = Math.sin(this.animTimer * 6) * 4;

        // Badan serigala
        ctx.fillStyle = coatColor;
        ctx.beginPath();
        ctx.roundRect(rx + 4, ry + 8, w - 8, h - 12, 6);
        ctx.fill();

        // Ekor lebat bergoyang
        ctx.fillStyle = '#484f58';
        ctx.beginPath();
        ctx.ellipse(rx + 2, ry + h - 8 + tailWag, 6, 4, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        // Moncong dan telinga runcing
        ctx.fillStyle = coatColor;
        ctx.beginPath();
        ctx.moveTo(rx + w - 8, ry + 8);
        ctx.lineTo(rx + w - 4, ry + 2);
        ctx.lineTo(rx + w, ry + 8);
        ctx.fill();

        // Mata serigala merah menyala
        ctx.fillStyle = '#ff7b72';
        ctx.fillRect(rx + w - 10, ry + 11, 3, 2);
        break;
      }

      case 'boss': {
        // Alpha Wolf Fenrir (World Boss Colossal)
        const bossColor = visual.color ?? '#3d1f5e';
        const auraPulse = Math.sin(this.animTimer * 4) * 4;

        // Aura bayangan ungu pekat mengelilingi boss
        ctx.fillStyle = 'rgba(163, 113, 247, 0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.6 + auraPulse, 0, Math.PI * 2);
        ctx.fill();

        // Bodi kokoh monster boss
        ctx.fillStyle = bossColor;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 10);
        ctx.fill();

        // Mahkota tanduk emas kegelapan
        ctx.fillStyle = '#e3b341';
        ctx.beginPath();
        ctx.moveTo(rx + 10, ry);
        ctx.lineTo(rx + 16, ry - 12);
        ctx.lineTo(rx + 22, ry);
        ctx.lineTo(cx, ry - 6);
        ctx.lineTo(rx + w - 22, ry);
        ctx.lineTo(rx + w - 16, ry - 12);
        ctx.lineTo(rx + w - 10, ry);
        ctx.fill();

        // Mata membara merah darah
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(rx + 14, ry + 16, 7, 4);
        ctx.fillRect(rx + w - 21, ry + 16, 7, 4);

        // Lambang rune kuno di dada boss
        ctx.strokeStyle = '#d2a8ff';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx + 16, ry + 26, w - 32, h - 36);
        break;
      }

      case 'campfire': {
        // Representasi Loot Drop / Peti Harta Karun di tanah
        const sparkle = Math.sin(this.animTimer * 6) * 3;
        const isGold = visual.label?.toLowerCase().includes('gold');
        const isPotion = visual.label?.toLowerCase().includes('potion');

        if (isGold) {
          // Kantong koin emas berkilau
          ctx.fillStyle = '#d29922';
          ctx.beginPath();
          ctx.ellipse(cx, cy + 2, 9, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e3b341';
          ctx.beginPath();
          ctx.arc(cx, cy - 3, 4, 0, Math.PI * 2);
          ctx.fill();

          // Bintang kilau di atas koin
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(cx + 4, cy - 6 + sparkle, 2, 2);
        } else if (isPotion) {
          // Botol ramuan kaca bersinar
          const isHp = visual.label?.toLowerCase().includes('hp');
          ctx.fillStyle = '#c9d1d9';
          ctx.fillRect(cx - 2, cy - 6, 4, 3); // Tutup botol
          ctx.fillStyle = isHp ? '#f85149' : '#1f6feb';
          ctx.beginPath();
          ctx.arc(cx, cy + 2, 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Peti harta karun mini bercahaya emas
          ctx.fillStyle = '#8b5a2b';
          ctx.fillRect(rx + 2, ry + 4, w - 4, h - 6);
          ctx.strokeStyle = '#e3b341';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rx + 2, ry + 4, w - 4, h - 6);
          ctx.fillStyle = '#f0c674';
          ctx.fillRect(cx - 2, cy - 1, 4, 4); // Kunci emas
        }
        break;
      }

      case 'npc': {
        // NPC Tetua Rowan: Jubah hijau zamrud & emas, jenggot putih, tongkat kayu ek, permata penuntun
        ctx.fillStyle = '#1b4d3e';
        ctx.fillRect(rx + 5, ry + 6, w - 10, h - 7);

        // Selendang amber emas
        ctx.fillStyle = '#e3b341';
        ctx.fillRect(rx + 8, ry + 8, w - 16, 4);

        // Wajah bijak & jenggot putih panjang
        ctx.fillStyle = '#ffe0bd';
        ctx.fillRect(rx + 10, ry + 5, w - 20, 6);
        ctx.fillStyle = '#f0f6fc';
        ctx.fillRect(rx + 9, ry + 11, w - 18, 9);

        // Topi tudung bijak
        ctx.fillStyle = '#0f2f26';
        ctx.beginPath();
        ctx.moveTo(rx + 6, ry + 6);
        ctx.lineTo(cx, ry - 3);
        ctx.lineTo(rx + w - 6, ry + 6);
        ctx.fill();

        // Tongkat jalan kayu ek dengan kristal hijau
        ctx.fillStyle = '#6e401f';
        ctx.fillRect(rx + w - 4, ry + 3, 3, 22);
        ctx.fillStyle = '#3fb950';
        ctx.beginPath();
        ctx.arc(rx + w - 3, ry + 2, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Floating Quest Marker di atas kepala NPC (Golden '!' bergoyang halus)
        const markerBounce = Math.sin(this.animTimer * 5) * 3;
        const iconY = ry - 22 + markerBounce;

        ctx.fillStyle = '#e3b341';
        ctx.beginPath();
        ctx.arc(cx, iconY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#161b22';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', cx, iconY + 3.5);
        break;
      }

      case 'bot': {
        // Visual khas sesuai nama dan kelas bot
        const botName = nameplate?.name ?? '';

        if (botName === 'Valkyrie') {
          // Valkyrie: Baju zirah baja emas bersayap, jubah biru langit, pedang dua tangan
          ctx.fillStyle = '#1f6feb'; // Jubah biru
          ctx.fillRect(rx + 3, ry + 7, w - 6, h - 8);

          ctx.fillStyle = '#da3633'; // Zirah dada merah kirmisi
          ctx.fillRect(rx + 6, ry + 5, w - 12, h - 11);

          // Sayap emas di helm
          ctx.fillStyle = '#f0c674';
          ctx.fillRect(rx + 4, ry + 2, 4, 5);
          ctx.fillRect(rx + w - 8, ry + 2, 4, 5);

          // Wajah & rambut pirang
          ctx.fillStyle = '#ffe0bd';
          ctx.fillRect(rx + 9, ry + 7, w - 18, 7);

          // Pedang emas besar disandang di punggung
          ctx.fillStyle = '#e3b341';
          ctx.fillRect(rx + w - 4, ry - 2, 4, 20);
        } else if (botName === 'ShadowBlade') {
          // ShadowBlade: Ninja pembunuh berselubung gelap dengan mata hijau dan belati ganda
          ctx.fillStyle = '#6e40c9'; // Selendang ungu berkibar
          ctx.fillRect(rx + 4, ry + 8, w - 8, h - 9);

          ctx.fillStyle = '#21262d'; // Baju ninja hitam pekat
          ctx.fillRect(rx + 6, ry + 5, w - 12, h - 11);

          // Topeng kain menutupi hidung & mulut
          ctx.fillStyle = '#161b22';
          ctx.fillRect(rx + 8, ry + 9, w - 16, 5);

          // Mata hijau bersinar di dalam tudung
          ctx.fillStyle = '#3fb950';
          ctx.fillRect(rx + 10, ry + 7, 3, 2);
          ctx.fillRect(rx + w - 13, ry + 7, 3, 2);

          // Dua belati bayangan beracun di tangan
          ctx.fillStyle = '#3fb950';
          ctx.fillRect(rx + 2, ry + 12, 3, 8);
          ctx.fillRect(rx + w - 5, ry + 12, 3, 8);
        } else if (botName === 'Merlin') {
          // Merlin: Jubah penyihir biru tua bertabur bintang, topi kerucut, dan tongkat permata
          ctx.fillStyle = '#1f242c'; // Jubah sihir
          ctx.fillRect(rx + 5, ry + 8, w - 10, h - 9);

          // Topi kerucut penyihir berujung lancip dengan bintang emas
          ctx.fillStyle = '#388bfd';
          ctx.beginPath();
          ctx.moveTo(rx + 4, ry + 6);
          ctx.lineTo(cx, ry - 6);
          ctx.lineTo(rx + w - 4, ry + 6);
          ctx.fill();
          ctx.fillStyle = '#f0c674';
          ctx.fillRect(cx - 2, ry + 4, 4, 3); // Gesper bintang

          // Jenggot perak panjang
          ctx.fillStyle = '#e6edf3';
          ctx.fillRect(rx + 11, ry + 12, w - 22, 6);

          // Tongkat sihir dengan permata kristal biru bercahaya
          ctx.fillStyle = '#8b5a2b';
          ctx.fillRect(rx + w - 4, ry + 2, 3, 18);
          ctx.fillStyle = '#58a6ff';
          ctx.beginPath();
          ctx.arc(rx + w - 3, ry + 1, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (botName === 'HealerKun') {
          // HealerKun: Jubah putih suci, lingkaran halo emas di atas kepala, dan gada matahari
          ctx.fillStyle = '#f0f6fc'; // Jubah putih suci
          ctx.fillRect(rx + 5, ry + 7, w - 10, h - 9);
          ctx.fillStyle = '#d29922'; // Garis emas liturgis
          ctx.fillRect(cx - 2, ry + 7, 4, h - 9);

          // Halo emas melayang di atas kepala
          ctx.strokeStyle = '#e3b341';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(cx, ry + 1, 7, 2.5, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Wajah ramah
          ctx.fillStyle = '#ffe0bd';
          ctx.fillRect(rx + 9, ry + 6, w - 18, 7);

          // Gada matahari suci
          ctx.fillStyle = '#e3b341';
          ctx.fillRect(rx + w - 5, ry + 6, 3, 14);
          ctx.beginPath();
          ctx.arc(rx + w - 4, ry + 5, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Bot generik
          ctx.fillStyle = visual.secondaryColor ?? '#1f6feb';
          ctx.fillRect(rx + 4, ry + 8, w - 8, h - 10);
          ctx.fillStyle = visual.color ?? '#58a6ff';
          ctx.fillRect(rx + 6, ry + 4, w - 12, h - 10);
          ctx.fillStyle = '#ffdfba';
          ctx.fillRect(rx + 9, ry + 7, w - 18, 9);
        }
        break;
      }

      case 'player':
      default: {
        // Pemain Utama: Hero Knight bersenjata pedang baja perak & perisai biru berlambang salib emas
        // Animasi langkah kaki
        const walkCycle = Math.sin(this.animTimer * 10) * 2;

        // Bodi zirah baja putih-perak
        ctx.fillStyle = '#3fb950'; // Tunic hijau ksatria
        ctx.fillRect(rx + 5, ry + 6, w - 10, h - 10);

        // Breastplate pelindung dada baja
        ctx.fillStyle = '#e6edf3';
        ctx.fillRect(rx + 7, ry + 8, w - 14, 9);
        // Permata safir biru di dada
        ctx.fillStyle = '#388bfd';
        ctx.fillRect(cx - 2, ry + 10, 4, 4);

        // Sabuk kulit emas
        ctx.fillStyle = '#d29922';
        ctx.fillRect(rx + 6, ry + h * 0.58, w - 12, 4);

        // Helm baja dengan bulu jambul merah megah
        ctx.fillStyle = '#c9d1d9';
        ctx.fillRect(rx + 8, ry + 4, w - 16, 7);
        ctx.fillStyle = '#da3633'; // Bulu merah di helm
        ctx.beginPath();
        ctx.moveTo(cx, ry + 4);
        ctx.lineTo(cx + 3, ry - 3);
        ctx.lineTo(cx - 3, ry - 1);
        ctx.fill();

        // Wajah ksatria
        ctx.fillStyle = '#ffe0bd';
        ctx.fillRect(rx + 9, ry + 8, w - 18, 5);

        // Kaki dan sepatu bot kulit
        ctx.fillStyle = '#4a2f13';
        ctx.fillRect(rx + 7, ry + h - 5 + walkCycle, 5, 5);
        ctx.fillRect(rx + w - 12, ry + h - 5 - walkCycle, 5, 5);

        // Pedang baja tajam di tangan kanan
        ctx.fillStyle = '#f0f6fc';
        ctx.fillRect(rx + w - 4, ry + 8, 3, 16);
        ctx.fillStyle = '#d29922'; // Pegangan pedang emas
        ctx.fillRect(rx + w - 6, ry + 14, 7, 3);

        // Perisai ksatria biru di lengan kiri
        ctx.fillStyle = '#1f6feb';
        ctx.beginPath();
        ctx.roundRect(rx + 1, ry + 10, 7, 12, 3);
        ctx.fill();
        ctx.fillStyle = '#f0c674';
        ctx.fillRect(rx + 3, ry + 13, 3, 6); // Lambang salib emas di perisai
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Menampilkan visual efek tebasan dan whirlwind saat menyerang.
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

    // Visual Whirlwind Slash saat skill aktif
    if (combat.currentSkillCooldown > combat.skillCooldown - 0.3) {
      const radius = combat.skillRange * 0.9;
      ctx.save();
      ctx.strokeStyle = '#bc8cff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

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
    } else if (nameplate.role === 'npc') {
      nameColor = '#f0c674';
    } else if (nameplate.role === 'monster' && stats.level >= 5) {
      nameColor = '#f0883e';
    }

    let statusTag = '';
    if (ai && ai.state === 'return') {
      statusTag = ' (Returning)';
      nameColor = '#3fb950';
    }

    const titleText = nameplate.title ? `<${nameplate.title}> ` : '';
    const levelText = nameplate.role === 'npc' ? '' : `[Lv.${stats.level}] `;
    const label = `${titleText}${levelText}${nameplate.name}${statusTag}`;

    // Outline gelap
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

      ctx.fillStyle = '#301818';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      const currentFill = calculateHealthBarWidth(stats.hp, stats.maxHp, barWidth);
      ctx.fillStyle = stats.hp / stats.maxHp > 0.3 ? '#3fb950' : '#f85149';
      ctx.fillRect(barX, barY, currentFill, barHeight);

      ctx.strokeStyle = '#0d1117';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    ctx.restore();
  }

  /**
   * Merender seluruh teks damage floating di layar.
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

      const lifeRatio = 1.0 - textComp.elapsed / textComp.lifetime;
      const fadeAlpha = Math.max(0, Math.min(1, lifeRatio));

      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.textAlign = 'center';
      ctx.font = textComp.isCrit ? 'bold 13px monospace' : '11px monospace';

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = textComp.isCrit ? 3.5 : 2.5;
      ctx.strokeText(textComp.text, rx, ry);

      ctx.fillStyle = textComp.color;
      ctx.fillText(textComp.text, rx, ry);

      ctx.restore();
    }
  }

  /**
   * Merender Antarmuka Pengguna (HUD) MMORPG di atas layar browser.
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
        this.renderActionBar(ctx, Math.round(vw / 2 - 100), vh - 52, combat, stats);
      }
    }

    // 3. Minimap Radar di Kanan Atas
    this.renderMinimap(ctx, vw - 134, 14, 120, 80, world, mainPlayerEntity);

    // 4. Quest Tracker di Kanan Bawah Minimap
    if (this.questManager) {
      this.renderQuestTracker(ctx, vw - 174, 104, 160, this.questManager);
    }

    // 5. Global MMO Chat Log di Kiri Bawah
    if (this.chatManager) {
      this.renderChatBox(ctx, 14, vh - 124, 270, 76);
    }

    ctx.restore();
  }

  /**
   * Minimap Radar navigasi di sudut kanan atas layar.
   */
  private renderMinimap(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    world: World,
    player?: Entity | null
  ): void {
    // Background frame radar gelap
    ctx.fillStyle = 'rgba(13, 17, 23, 0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Header radar menampilkan waktu dunia dan fase siang/malam
    const timeLabel = this.dayNightSystem
      ? `${this.dayNightSystem.getTimeString()} (${this.dayNightSystem.getPhase().toUpperCase()})`
      : 'RADAR (CH 1)';
    ctx.fillStyle = '#f0c674';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(timeLabel, x + 5, y + 10);

    const scaleX = w / this.worldWidth;
    const scaleY = h / this.worldHeight;

    // Gambar viewport kamera saat ini
    const camBoxX = x + this.camera.x * scaleX;
    const camBoxY = y + this.camera.y * scaleY;
    const camBoxW = this.camera.viewportWidth * scaleX;
    const camBoxH = this.camera.viewportHeight * scaleY;

    ctx.strokeStyle = 'rgba(240, 198, 116, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(camBoxX, camBoxY, camBoxW, camBoxH);

    // Titik NPC di Minimap: titik emas
    const npcs = world.query(NPCComponent, TransformComponent);
    for (const npc of npcs) {
      const nTrans = world.getComponent(npc, TransformComponent);
      if (nTrans) {
        const nx = x + nTrans.x * scaleX;
        const ny = y + nTrans.y * scaleY;
        ctx.fillStyle = '#e3b341';
        ctx.beginPath();
        ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Titik Bot Pemain di Minimap: titik biru langit
    const bots = world.query(SimulatedPlayerComponent, TransformComponent);
    for (const b of bots) {
      const bTrans = world.getComponent(b, TransformComponent);
      if (bTrans) {
        const bx = x + bTrans.x * scaleX;
        const by = y + bTrans.y * scaleY;
        ctx.fillStyle = '#79c0ff';
        ctx.fillRect(bx - 1, by - 1, 2, 2);
      }
    }

    // Gambar titik monster
    const monsters = world.query(MonsterAIComponent, TransformComponent, StatsComponent);
    for (const m of monsters) {
      const trans = world.getComponent(m, TransformComponent);
      const stats = world.getComponent(m, StatsComponent);
      if (!trans || !stats || stats.hp <= 0) continue;

      const mx = x + trans.x * scaleX;
      const my = y + trans.y * scaleY;

      if (stats.level >= 7) {
        // World Boss: titik ungu
        ctx.fillStyle = '#bc8cff';
        ctx.fillRect(mx - 2, my - 2, 4, 4);
      } else {
        // Monster biasa: titik merah
        ctx.fillStyle = '#f85149';
        ctx.fillRect(mx - 1, my - 1, 2, 2);
      }
    }

    // Titik Pemain Utama: titik hijau terang
    if (player) {
      const pTrans = world.getComponent(player, TransformComponent);
      if (pTrans) {
        const px = x + pTrans.x * scaleX;
        const py = y + pTrans.y * scaleY;
        ctx.fillStyle = '#3fb950';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Pelacak Quest aktif di bawah radar.
   */
  private renderQuestTracker(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    questManager: QuestManager
  ): void {
    const quests = questManager.getAllQuests();
    const h = 20 + quests.length * 16;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#f0c674';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('📜 Quests Active', x + 6, y + 12);

    let lineY = y + 25;
    for (const q of quests) {
      ctx.font = '8px monospace';
      if (q.isCompleted) {
        ctx.fillStyle = '#3fb950';
        ctx.fillText(`✓ [Done] ${q.title.slice(0, 14)}`, x + 6, lineY);
      } else {
        ctx.fillStyle = '#c9d1d9';
        ctx.fillText(`• (${q.currentCount}/${q.requiredCount}) ${q.title.slice(0, 13)}`, x + 6, lineY);
      }
      lineY += 15;
    }
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

    // HP Bar
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

    // MP Bar
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

    // EXP Bar
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
   * Action Hotbar di Tengah Bawah.
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

      ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
      ctx.fillRect(sx, y, slotSize, slotSize);
      ctx.strokeStyle = slot.cd > 0 ? '#484f58' : '#58a6ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, y, slotSize, slotSize);

      ctx.fillStyle = '#79c0ff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(slot.key, sx + 3, y + 10);

      ctx.fillStyle = '#e6edf3';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(slot.label, sx + slotSize / 2, y + 26);

      if (slot.count !== null) {
        ctx.fillStyle = '#3fb950';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`x${slot.count}`, sx + slotSize - 3, y + slotSize - 4);
      }

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

    ctx.fillStyle = '#8b949e';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('💬 Global Chat', x + 6, y + 12);

    const messages = this.chatManager.getMessages();
    const displayMessages = messages.slice(-3);
    let lineY = y + 26;

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
      ctx.fillText(`${senderText}${msg.text.slice(0, 28)}`, x + 50, lineY);

      lineY += 15;
    }
  }

  /**
   * Menampilkan prompt interaksi [F] di atas kepala NPC yang sedang didekati pemain.
   */
  private renderNPCInteractionPrompt(world: World, ctx: CanvasRenderingContext2D): void {
    if (!this.npcSystem || !this.npcSystem.nearbyNPC || this.npcSystem.isDialogueOpen) return;

    const nearbyTrans = world.getComponent(this.npcSystem.nearbyNPC, TransformComponent);
    const nearbyComp = world.getComponent(this.npcSystem.nearbyNPC, NPCComponent);
    if (!nearbyTrans || !nearbyComp) return;

    const nx = nearbyTrans.x + 16;
    const ny = nearbyTrans.y - 36;

    ctx.save();
    ctx.font = 'bold 10px monospace';
    const text = `[F] Talk to ${nearbyComp.name}`;
    const tw = ctx.measureText(text).width;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
    ctx.beginPath();
    ctx.roundRect(nx - tw / 2 - 8, ny - 10, tw + 16, 18, 5);
    ctx.fill();

    ctx.strokeStyle = '#e3b341';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#f0c674';
    ctx.textAlign = 'center';
    ctx.fillText(text, nx, ny + 3);
    ctx.restore();
  }

  /**
   * Mengumpulkan seluruh sumber cahaya di dunia (pemain, api unggun, bot, boss).
   */
  private collectLightSources(
    world: World,
    player?: Entity | null,
    alpha: number = 1.0
  ): LightSource[] {
    const lights: LightSource[] = [];

    // 1. Obor / Lentera Pemain Utama
    if (player) {
      const pTrans = world.getComponent(player, TransformComponent);
      if (pTrans) {
        const px = pTrans.prevX + (pTrans.x - pTrans.prevX) * alpha + 16;
        const py = pTrans.prevY + (pTrans.y - pTrans.prevY) * alpha + 16;
        lights.push({
          x: px,
          y: py,
          radius: 140,
          intensity: 0.92,
          color: 'rgba(255, 195, 80, 0.22)',
        });
      }
    }

    // 2. Api Unggun / Lentera Desa di Pusat Sanctuary
    lights.push({
      x: 430,
      y: 350,
      radius: 170,
      intensity: 0.95,
      color: 'rgba(255, 130, 40, 0.3)',
    });

    // 3. Lentera Bot Pemain
    const bots = world.query(SimulatedPlayerComponent, TransformComponent);
    for (const bot of bots) {
      const bTrans = world.getComponent(bot, TransformComponent);
      if (bTrans) {
        const bx = bTrans.prevX + (bTrans.x - bTrans.prevX) * alpha + 16;
        const by = bTrans.prevY + (bTrans.y - bTrans.prevY) * alpha + 16;
        lights.push({
          x: bx,
          y: by,
          radius: 80,
          intensity: 0.75,
          color: 'rgba(200, 225, 255, 0.15)',
        });
      }
    }

    // 4. Aura Ungu Berpendar dari World Boss Fenrir
    const monsters = world.query(MonsterAIComponent, TransformComponent, StatsComponent);
    for (const m of monsters) {
      const stats = world.getComponent(m, StatsComponent);
      const mTrans = world.getComponent(m, TransformComponent);
      if (stats && mTrans && stats.level >= 7 && stats.hp > 0) {
        const mx = mTrans.prevX + (mTrans.x - mTrans.prevX) * alpha + 27;
        const my = mTrans.prevY + (mTrans.y - mTrans.prevY) * alpha + 27;
        lights.push({
          x: mx,
          y: my,
          radius: 160,
          intensity: 0.85,
          color: 'rgba(180, 90, 255, 0.25)',
        });
      }
    }

    return lights;
  }

  /**
   * Merender Modal Percakapan Interaktif NPC di Layar Layar Browser.
   */
  private renderDialogueModal(ctx: CanvasRenderingContext2D, world: World): void {
    if (!this.npcSystem || !this.npcSystem.isDialogueOpen || !this.npcSystem.activeNPC) return;

    const npcComp = world.getComponent(this.npcSystem.activeNPC, NPCComponent);
    const node = this.npcSystem.getCurrentNode(world);
    if (!npcComp || !node) return;

    const vw = this.camera.viewportWidth;
    const vh = this.camera.viewportHeight;

    const mw = Math.min(680, vw - 40);
    const mh = 145;
    const mx = Math.round((vw - mw) / 2);
    const my = vh - mh - 20;

    ctx.save();

    // Box Dialog Latar Belakang
    ctx.fillStyle = 'rgba(9, 13, 19, 0.95)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#e3b341';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mw, mh);

    // Avatar Box
    const avSize = 48;
    const avX = mx + 14;
    const avY = my + 14;
    ctx.fillStyle = '#161b22';
    ctx.fillRect(avX, avY, avSize, avSize);
    ctx.strokeStyle = '#d29922';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(avX, avY, avSize, avSize);

    // Avatar Tetua Rowan
    ctx.fillStyle = '#1b4d3e';
    ctx.fillRect(avX + 8, avY + 12, 32, 32);
    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(avX + 16, avY + 14, 16, 12);
    ctx.fillStyle = '#f0f6fc';
    ctx.fillRect(avX + 14, avY + 24, 20, 16);
    ctx.fillStyle = '#e3b341';
    ctx.beginPath();
    ctx.moveTo(avX + 10, avY + 14);
    ctx.lineTo(avX + 24, avY + 4);
    ctx.lineTo(avX + 38, avY + 14);
    ctx.fill();

    // Nama & Gelar NPC
    ctx.fillStyle = '#e3b341';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${npcComp.name}`, mx + 72, my + 20);

    ctx.fillStyle = '#8b949e';
    ctx.font = '10px monospace';
    ctx.fillText(`<${npcComp.title}>`, mx + 72, my + 34);

    // Teks Isi Ucapan NPC
    ctx.fillStyle = '#e6edf3';
    ctx.font = '11px monospace';
    const textX = mx + 72;
    let textY = my + 50;

    const words = node.npcText.split(' ');
    let currentLine = '';
    const maxLineW = mw - 90;

    for (const w of words) {
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      if (ctx.measureText(testLine).width > maxLineW) {
        ctx.fillText(currentLine, textX, textY);
        currentLine = w;
        textY += 15;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, textX, textY);
    }

    // Opsi Percabangan Dialog di Bagian Bawah
    let optY = my + 92;
    for (let i = 0; i < node.options.length; i++) {
      const opt = node.options[i];
      const optBoxH = 16;
      ctx.fillStyle = '#161b22';
      ctx.fillRect(mx + 72, optY - 11, mw - 90, optBoxH);
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx + 72, optY - 11, mw - 90, optBoxH);

      ctx.fillStyle = '#58a6ff';
      ctx.font = '10px monospace';
      ctx.fillText(`[${i + 1}] ${opt.text}`, mx + 76, optY + 1);
      optY += 18;
    }

    ctx.restore();
  }

  /**
   * Merender Modal Inventaris Tas & Perlengkapan Karakter (Equipment Paperdoll).
   */
  private renderInventoryModal(
    ctx: CanvasRenderingContext2D,
    inv: InventoryComponent,
    stats: StatsComponent
  ): void {
    const vw = this.camera.viewportWidth;
    const vh = this.camera.viewportHeight;

    const mw = Math.min(520, vw - 30);
    const mh = 310;
    const mx = Math.round((vw - mw) / 2);
    const my = Math.round((vh - mh) / 2);

    ctx.save();

    // Background Modal
    ctx.fillStyle = 'rgba(13, 17, 23, 0.96)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mw, mh);

    // Header Modal
    ctx.fillStyle = '#161b22';
    ctx.fillRect(mx, my, mw, 28);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, 28);

    ctx.fillStyle = '#f0c674';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('🎒 Hero Inventory & Equipment (Press [I] to Close)', mx + 12, my + 18);

    // Kolom Kiri: Slot Perlengkapan Terpasang
    const leftX = mx + 14;
    const leftY = my + 38;

    ctx.fillStyle = '#79c0ff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('⚔️ Equipment Slots', leftX, leftY);

    const equipSlots: { slot: 'weapon' | 'armor' | 'accessory'; label: string; icon: string }[] = [
      { slot: 'weapon', label: 'Weapon', icon: '⚔️' },
      { slot: 'armor', label: 'Armor', icon: '🛡️' },
      { slot: 'accessory', label: 'Accessory', icon: '💍' },
    ];

    let eqY = leftY + 8;
    for (const eq of equipSlots) {
      const item = inv.equipment[eq.slot];
      ctx.fillStyle = '#21262d';
      ctx.fillRect(leftX, eqY, 180, 26);
      ctx.strokeStyle = item ? '#e3b341' : '#30363d';
      ctx.lineWidth = 1;
      ctx.strokeRect(leftX, eqY, 180, 26);

      ctx.fillStyle = '#c9d1d9';
      ctx.font = '9px monospace';
      ctx.fillText(`${eq.icon} ${eq.label}:`, leftX + 4, eqY + 16);

      if (item) {
        ctx.fillStyle = '#58a6ff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(item.name.slice(0, 14), leftX + 75, eqY + 16);
      } else {
        ctx.fillStyle = '#6e7681';
        ctx.font = 'italic 9px monospace';
        ctx.fillText('(Empty)', leftX + 75, eqY + 16);
      }
      eqY += 30;
    }

    // Ringkasan Status Karakter di Kolom Kiri
    const statBoxY = eqY + 4;
    ctx.fillStyle = '#161b22';
    ctx.fillRect(leftX, statBoxY, 180, 80);
    ctx.strokeStyle = '#30363d';
    ctx.strokeRect(leftX, statBoxY, 180, 80);

    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('📊 Character Stats', leftX + 6, statBoxY + 14);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#ff7b72';
    ctx.fillText(`Attack:  ${stats.attack}`, leftX + 8, statBoxY + 30);
    ctx.fillStyle = '#79c0ff';
    ctx.fillText(`Defense: ${stats.defense}`, leftX + 90, statBoxY + 30);

    ctx.fillStyle = '#3fb950';
    ctx.fillText(`Max HP:  ${stats.maxHp}`, leftX + 8, statBoxY + 46);
    ctx.fillStyle = '#a371f7';
    ctx.fillText(`Max MP:  ${stats.maxMp}`, leftX + 90, statBoxY + 46);

    ctx.fillStyle = '#f0883e';
    ctx.fillText(`Gold:    ${stats.gold} G`, leftX + 8, statBoxY + 62);
    ctx.fillStyle = '#e3b341';
    ctx.fillText(`Crit:    ${Math.round(stats.critChance * 100)}%`, leftX + 90, statBoxY + 62);

    // Kolom Kanan: Grid 4x4 Tas Inventaris (16 Slot)
    const rightX = leftX + 195;
    const rightY = leftY;

    ctx.fillStyle = '#79c0ff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('📦 Bag Items (1-8 to Use/Equip)', rightX, rightY);

    const slotSize = 36;
    const gap = 6;
    const cols = 4;

    for (let i = 0; i < inv.maxSlots; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = rightX + col * (slotSize + gap);
      const sy = rightY + 8 + row * (slotSize + gap);

      const item = inv.slots[i];
      const isSelected = inv.selectedSlotIndex === i;

      ctx.fillStyle = isSelected ? '#263342' : '#161b22';
      ctx.fillRect(sx, sy, slotSize, slotSize);

      let borderColor = '#30363d';
      if (item) {
        if (item.rarity === 'legendary') borderColor = '#f0883e';
        else if (item.rarity === 'epic') borderColor = '#bc8cff';
        else if (item.rarity === 'rare') borderColor = '#58a6ff';
        else borderColor = '#8b949e';
      }
      if (isSelected) borderColor = '#e3b341';

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(sx, sy, slotSize, slotSize);

      // Nomor urut slot
      ctx.fillStyle = '#484f58';
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}`, sx + 2, sy + 7);

      if (item) {
        // Teks singkatan item
        ctx.fillStyle = '#e6edf3';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        const abbr = item.name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase();
        ctx.fillText(abbr, sx + slotSize / 2, sy + slotSize / 2 + 2);

        // Kuantitas badge
        if (item.quantity > 1) {
          ctx.fillStyle = '#3fb950';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`x${item.quantity}`, sx + slotSize - 2, sy + slotSize - 2);
        }
      }
    }

    // Kotak Info Item Tooltip di Bagian Bawah
    const tipY = my + mh - 58;
    ctx.fillStyle = '#161b22';
    ctx.fillRect(mx + 14, tipY, mw - 28, 48);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 14, tipY, mw - 28, 48);

    const selIndex = inv.selectedSlotIndex ?? 0;
    const selectedItem = inv.slots[selIndex];
    ctx.textAlign = 'left';

    if (selectedItem) {
      let rColor = '#8b949e';
      if (selectedItem.rarity === 'epic') rColor = '#bc8cff';
      if (selectedItem.rarity === 'rare') rColor = '#58a6ff';
      ctx.fillStyle = rColor;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`[Slot ${selIndex + 1}] ${selectedItem.name} (${selectedItem.type})`, mx + 20, tipY + 14);

      ctx.fillStyle = '#8b949e';
      ctx.font = '9px monospace';
      ctx.fillText(selectedItem.description, mx + 20, tipY + 28);

      let bonusText = '';
      if (selectedItem.statBonus) {
        const b = selectedItem.statBonus;
        if (b.attack) bonusText += `+${b.attack} ATK `;
        if (b.defense) bonusText += `+${b.defense} DEF `;
        if (b.maxHp) bonusText += `+${b.maxHp} HP `;
      }
      if (selectedItem.healHp) bonusText += `Restores +${selectedItem.healHp} HP `;
      if (selectedItem.healMp) bonusText += `Restores +${selectedItem.healMp} MP `;

      ctx.fillStyle = '#3fb950';
      ctx.fillText(`Effects: ${bonusText || 'None'} | Press [1-${inv.maxSlots}] to Equip/Use`, mx + 20, tipY + 42);
    } else {
      ctx.fillStyle = '#6e7681';
      ctx.font = '9px monospace';
      ctx.fillText(`[Slot ${selIndex + 1}] Empty Slot: Select another slot or press [I] to close.`, mx + 20, tipY + 26);
    }

    ctx.restore();
  }
}
