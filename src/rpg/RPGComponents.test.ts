import { describe, it, expect } from 'vitest';
import {
  StatsComponent,
  CombatComponent,
  NameplateComponent,
  MonsterAIComponent,
  SimulatedPlayerComponent,
  FloatingTextComponent,
} from './RPGComponents';

describe('RPG ECS Components', () => {
  it('harus menginisialisasi StatsComponent dengan nilai default yang valid', () => {
    const stats = new StatsComponent();
    expect(stats.hp).toBe(120);
    expect(stats.maxHp).toBe(120);
    expect(stats.mp).toBe(60);
    expect(stats.maxMp).toBe(60);
    expect(stats.level).toBe(1);
    expect(stats.exp).toBe(0);
    expect(stats.attack).toBe(18);
    expect(stats.defense).toBe(6);
    expect(stats.critChance).toBeCloseTo(0.2, 2);
    expect(stats.critMultiplier).toBeCloseTo(1.75, 2);
    expect(stats.hpPotions).toBe(3);
    expect(stats.mpPotions).toBe(2);
  });

  it('harus menginisialisasi CombatComponent dengan skill aktif', () => {
    const combat = new CombatComponent();
    expect(combat.attackRange).toBe(48);
    expect(combat.attackCooldown).toBe(0.45);
    expect(combat.currentAttackCooldown).toBe(0);
    expect(combat.skillName).toBe('Whirlwind Slash');
    expect(combat.skillCostMp).toBe(20);
    expect(combat.skillCooldown).toBe(3.0);
    expect(combat.currentSkillCooldown).toBe(0);
  });

  it('harus menginisialisasi NameplateComponent dengan role dan title', () => {
    const nameplate = new NameplateComponent('Azyte', 'player', '<Guild Master>');
    expect(nameplate.name).toBe('Azyte');
    expect(nameplate.role).toBe('player');
    expect(nameplate.title).toBe('<Guild Master>');
    expect(nameplate.showHealthBar).toBe(true);
  });

  it('harus menginisialisasi MonsterAIComponent dengan home coordinates dan radius', () => {
    const ai = new MonsterAIComponent(200, 150, 120, 240);
    expect(ai.homeX).toBe(200);
    expect(ai.homeY).toBe(150);
    expect(ai.aggroRadius).toBe(120);
    expect(ai.leashRadius).toBe(240);
    expect(ai.state).toBe('idle');
  });

  it('harus menginisialisasi SimulatedPlayerComponent dengan timer default', () => {
    const bot = new SimulatedPlayerComponent();
    expect(bot.chatCooldown).toBeGreaterThan(0);
    expect(bot.behavior).toBe('farming');
  });

  it('harus menginisialisasi FloatingTextComponent untuk damage biasa dan critical', () => {
    const normal = new FloatingTextComponent('-24', '#f85149', false);
    expect(normal.text).toBe('-24');
    expect(normal.isCrit).toBe(false);

    const crit = new FloatingTextComponent('CRIT! -48', '#d29922', true);
    expect(crit.isCrit).toBe(true);
  });
});
