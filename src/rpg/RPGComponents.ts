import type { Entity } from '../ecs/Entity';

export interface StatsOptions {
  hp?: number;
  maxHp?: number;
  mp?: number;
  maxMp?: number;
  level?: number;
  exp?: number;
  nextLevelExp?: number;
  attack?: number;
  defense?: number;
  critChance?: number;
  critMultiplier?: number;
  gold?: number;
  hpPotions?: number;
  mpPotions?: number;
}

/**
 * StatsComponent menyimpan atribut RPG dasar: darah, mana, level, exp, dan status tempur.
 */
export class StatsComponent {
  public hp: number;
  public maxHp: number;
  public mp: number;
  public maxMp: number;
  public level: number;
  public exp: number;
  public nextLevelExp: number;
  public attack: number;
  public defense: number;
  public critChance: number;
  public critMultiplier: number;
  public gold: number;
  public hpPotions: number;
  public mpPotions: number;

  constructor(options?: StatsOptions) {
    this.hp = options?.hp ?? 120;
    this.maxHp = options?.maxHp ?? 120;
    this.mp = options?.mp ?? 60;
    this.maxMp = options?.maxMp ?? 60;
    this.level = options?.level ?? 1;
    this.exp = options?.exp ?? 0;
    this.nextLevelExp = options?.nextLevelExp ?? 80;
    this.attack = options?.attack ?? 18;
    this.defense = options?.defense ?? 6;
    this.critChance = options?.critChance ?? 0.2;
    this.critMultiplier = options?.critMultiplier ?? 1.75;
    this.gold = options?.gold ?? 0;
    this.hpPotions = options?.hpPotions ?? 3;
    this.mpPotions = options?.mpPotions ?? 2;
  }
}

export interface CombatOptions {
  attackRange?: number;
  attackCooldown?: number;
  skillName?: string;
  skillCostMp?: number;
  skillCooldown?: number;
  skillRange?: number;
  skillMultiplier?: number;
}

/**
 * CombatComponent menyimpan kapabilitas penyerangan: basic attack dan skill aktif.
 */
export class CombatComponent {
  public attackRange: number;
  public attackCooldown: number;
  public currentAttackCooldown: number = 0;

  public skillName: string;
  public skillCostMp: number;
  public skillCooldown: number;
  public currentSkillCooldown: number = 0;
  public skillRange: number;
  public skillMultiplier: number;

  public isAttacking: boolean = false;
  public targetEntity: Entity | null = null;

  constructor(options?: CombatOptions) {
    this.attackRange = options?.attackRange ?? 48;
    this.attackCooldown = options?.attackCooldown ?? 0.45;
    this.skillName = options?.skillName ?? 'Whirlwind Slash';
    this.skillCostMp = options?.skillCostMp ?? 20;
    this.skillCooldown = options?.skillCooldown ?? 3.0;
    this.skillRange = options?.skillRange ?? 72;
    this.skillMultiplier = options?.skillMultiplier ?? 2.2;
  }
}

export type EntityRole = 'player' | 'other_player' | 'monster' | 'npc';

/**
 * NameplateComponent mengatur label nama, gelar, dan bar HP yang melayang di atas kepala.
 */
export class NameplateComponent {
  constructor(
    public name: string,
    public role: EntityRole = 'monster',
    public title: string = '',
    public showHealthBar: boolean = true
  ) {}
}

export type MonsterState = 'idle' | 'patrol' | 'chase' | 'attack' | 'return';

/**
 * MonsterAIComponent mengatur state machine musuh dengan sistem deteksi (aggro) dan leashing.
 */
export class MonsterAIComponent {
  public state: MonsterState = 'idle';
  public stateTimer: number = 0;
  public homeX: number;
  public homeY: number;
  public targetEntity: Entity | null = null;

  constructor(
    x: number,
    y: number,
    public aggroRadius: number = 130,
    public leashRadius: number = 260
  ) {
    this.homeX = x;
    this.homeY = y;
  }
}

export type BotBehavior = 'farming' | 'exploring';

/**
 * SimulatedPlayerComponent menggerakkan bot pemain lain dalam simulasi MMORPG online.
 */
export class SimulatedPlayerComponent {
  public stateTimer: number = 0;
  public chatCooldown: number = 6.0;
  public targetMonster: Entity | null = null;
  public behavior: BotBehavior = 'farming';
}

/**
 * FloatingTextComponent memunculkan angka damage, EXP, dan tulisan Level Up melayang di canvas.
 */
export class FloatingTextComponent {
  public lifetime: number = 0.85;
  public elapsed: number = 0;

  constructor(
    public text: string,
    public color: string = '#f85149',
    public isCrit: boolean = false,
    public vy: number = -45
  ) {}
}
