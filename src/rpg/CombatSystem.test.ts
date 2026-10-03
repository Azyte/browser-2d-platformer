import { describe, it, expect } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import {
  StatsComponent,
  CombatComponent,
  FloatingTextComponent,
} from './RPGComponents';
import { CombatSystem } from './CombatSystem';

describe('CombatSystem', () => {
  it('harus menghitung damage fisik, mengurangi HP target, dan mereset cooldown serangan', () => {
    const world = new World();
    const combatSystem = new CombatSystem();
    world.addSystem(combatSystem);

    // Penyerang (Atk = 20, Def = 5)
    const attacker = world.createEntity();
    world.addComponent(attacker, new TransformComponent(0, 0));
    world.addComponent(attacker, new StatsComponent({ attack: 20, critChance: 0 }));
    world.addComponent(attacker, new CombatComponent({ attackRange: 50, attackCooldown: 0.5 }));

    // Target (Hp = 100, Def = 5) -> Damage = 20 - 5 = 15
    const target = world.createEntity();
    world.addComponent(target, new TransformComponent(30, 0));
    world.addComponent(target, new StatsComponent({ hp: 100, defense: 5 }));

    const success = combatSystem.executeBasicAttack(world, attacker, target);
    expect(success).toBe(true);

    const targetStats = world.getComponent(target, StatsComponent)!;
    expect(targetStats.hp).toBe(85); // 100 - 15

    const attackerCombat = world.getComponent(attacker, CombatComponent)!;
    expect(attackerCombat.currentAttackCooldown).toBe(0.5);

    // Serangan kedua langsung gagal karena cooldown belum habis
    const secondSuccess = combatSystem.executeBasicAttack(world, attacker, target);
    expect(secondSuccess).toBe(false);
  });

  it('harus memotong MP dan melancarkan damage jurus (Skill)', () => {
    const world = new World();
    const combatSystem = new CombatSystem();

    const attacker = world.createEntity();
    world.addComponent(attacker, new TransformComponent(0, 0));
    world.addComponent(attacker, new StatsComponent({ attack: 20, mp: 30, critChance: 0 }));
    world.addComponent(
      attacker,
      new CombatComponent({ skillCostMp: 15, skillMultiplier: 2.0, skillCooldown: 2.0 })
    );

    const target = world.createEntity();
    world.addComponent(target, new TransformComponent(30, 0));
    world.addComponent(target, new StatsComponent({ hp: 100, defense: 10 })); // Base = 20 - 10 = 10. Skill 2x = 20

    const success = combatSystem.executeSkill(world, attacker, target);
    expect(success).toBe(true);

    const attackerStats = world.getComponent(attacker, StatsComponent)!;
    expect(attackerStats.mp).toBe(15); // 30 - 15

    const targetStats = world.getComponent(target, StatsComponent)!;
    expect(targetStats.hp).toBe(80); // 100 - 20
  });

  it('harus memicu Level Up saat EXP mencapai ambang batas, memulihkan HP/MP, dan menaikkan status', () => {
    const world = new World();
    const combatSystem = new CombatSystem();

    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(0, 0));
    world.addComponent(
      player,
      new StatsComponent({
        level: 1,
        exp: 70,
        nextLevelExp: 80,
        hp: 40,
        maxHp: 100,
        attack: 10,
      })
    );

    // Beri 20 EXP (70 + 20 = 90 >= 80 -> memicu level up)
    combatSystem.rewardExp(world, player, 20);

    const stats = world.getComponent(player, StatsComponent)!;
    expect(stats.level).toBe(2);
    expect(stats.exp).toBe(10); // Sisa 90 - 80 = 10
    expect(stats.hp).toBe(stats.maxHp); // Pulih penuh
    expect(stats.attack).toBeGreaterThan(10);
  });

  it('harus memulihkan HP saat meminum potion dan mengurangi jumlah potion di inventori', () => {
    const combatSystem = new CombatSystem();
    const stats = new StatsComponent({ hp: 50, maxHp: 100, hpPotions: 2 });

    const drank = combatSystem.useHpPotion(stats);
    expect(drank).toBe(true);
    expect(stats.hp).toBe(100); // 50 + 50 = 100
    expect(stats.hpPotions).toBe(1);
  });
});
