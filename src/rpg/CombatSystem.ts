import type { World } from '../ecs/World';
import type { Entity } from '../ecs/Entity';
import type { System } from '../ecs/System';
import { TransformComponent } from '../physics/TransformComponent';
import {
  StatsComponent,
  CombatComponent,
  FloatingTextComponent,
} from './RPGComponents';

/**
 * CombatSystem mengelola interaksi tempur RPG:
 * Kalkulasi damage, Critical Hit, pemakaian Skill, perolehan EXP & Level Up, dan Floating Text.
 */
export class CombatSystem implements System {
  /**
   * Siklus update combat untuk mengurangi timer cooldown dan menggerakkan teks floating damage.
   */
  public update(world: World, dt: number): void {
    // 1. Kurangi Cooldown Serangan dan Skill
    const combatants = world.query(CombatComponent);
    for (const entity of combatants) {
      const combat = world.getComponent(entity, CombatComponent);
      if (!combat) continue;

      if (combat.currentAttackCooldown > 0) {
        combat.currentAttackCooldown = Math.max(0, combat.currentAttackCooldown - dt);
      }
      if (combat.currentSkillCooldown > 0) {
        combat.currentSkillCooldown = Math.max(0, combat.currentSkillCooldown - dt);
      }
    }

    // 2. Perbarui posisi teks floating damage dan musnahkan yang telah kadaluarsa
    const floatingEntities = world.query(TransformComponent, FloatingTextComponent);
    for (const entity of floatingEntities) {
      const transform = world.getComponent(entity, TransformComponent);
      const text = world.getComponent(entity, FloatingTextComponent);
      if (!transform || !text) continue;

      transform.y += text.vy * dt;
      text.elapsed += dt;

      if (text.elapsed >= text.lifetime) {
        world.queueDestroy(entity);
      }
    }
  }

  /**
   * Melancarkan serangan dasar (Basic Attack) ke target jika berada dalam jangkauan dan cooldown siap.
   */
  public executeBasicAttack(world: World, attacker: Entity, target: Entity): boolean {
    const attackerTransform = world.getComponent(attacker, TransformComponent);
    const attackerStats = world.getComponent(attacker, StatsComponent);
    const attackerCombat = world.getComponent(attacker, CombatComponent);

    const targetTransform = world.getComponent(target, TransformComponent);
    const targetStats = world.getComponent(target, StatsComponent);

    if (!attackerTransform || !attackerStats || !attackerCombat || !targetTransform || !targetStats) {
      return false;
    }

    if (attackerCombat.currentAttackCooldown > 0) {
      return false;
    }

    const dist = this.getDistance(attackerTransform, targetTransform);
    if (dist > attackerCombat.attackRange) {
      return false;
    }

    attackerCombat.currentAttackCooldown = attackerCombat.attackCooldown;

    // Formula damage: max(1, Atk - Def)
    const baseDamage = Math.max(1, attackerStats.attack - targetStats.defense);
    const isCrit = Math.random() < attackerStats.critChance;
    const finalDamage = Math.round(baseDamage * (isCrit ? attackerStats.critMultiplier : 1.0));

    targetStats.hp = Math.max(0, targetStats.hp - finalDamage);

    // Munculkan teks floating damage di lokasi target
    this.spawnFloatingText(
      world,
      targetTransform.x + 10,
      targetTransform.y - 10,
      isCrit ? `CRIT! -${finalDamage}` : `-${finalDamage}`,
      isCrit ? '#d29922' : '#f85149',
      isCrit
    );

    return true;
  }

  /**
   * Melancarkan jurus aktif (Skill) yang mengonsumsi MP untuk melipatgandakan damage.
   */
  public executeSkill(world: World, attacker: Entity, target: Entity): boolean {
    const attackerTransform = world.getComponent(attacker, TransformComponent);
    const attackerStats = world.getComponent(attacker, StatsComponent);
    const attackerCombat = world.getComponent(attacker, CombatComponent);

    const targetTransform = world.getComponent(target, TransformComponent);
    const targetStats = world.getComponent(target, StatsComponent);

    if (!attackerTransform || !attackerStats || !attackerCombat || !targetTransform || !targetStats) {
      return false;
    }

    if (attackerCombat.currentSkillCooldown > 0 || attackerStats.mp < attackerCombat.skillCostMp) {
      return false;
    }

    const dist = this.getDistance(attackerTransform, targetTransform);
    if (dist > attackerCombat.skillRange) {
      return false;
    }

    attackerStats.mp -= attackerCombat.skillCostMp;
    attackerCombat.currentSkillCooldown = attackerCombat.skillCooldown;

    const baseDamage = Math.max(1, attackerStats.attack - targetStats.defense);
    const skillDamage = Math.round(baseDamage * attackerCombat.skillMultiplier);

    targetStats.hp = Math.max(0, targetStats.hp - skillDamage);

    this.spawnFloatingText(
      world,
      targetTransform.x + 10,
      targetTransform.y - 14,
      `${attackerCombat.skillName}! -${skillDamage}`,
      '#bc8cff',
      true
    );

    return true;
  }

  /**
   * Memberikan EXP ke karakter dan memproses kenaikan level (Level Up).
   */
  public rewardExp(world: World, player: Entity, amount: number): void {
    const stats = world.getComponent(player, StatsComponent);
    const transform = world.getComponent(player, TransformComponent);
    if (!stats) return;

    stats.exp += amount;

    // Evaluasi kenaikan level
    while (stats.exp >= stats.nextLevelExp) {
      stats.exp -= stats.nextLevelExp;
      stats.level += 1;
      stats.nextLevelExp = Math.round(stats.nextLevelExp * 1.5);

      // Peningkatan status dan pemulihan penuh
      stats.maxHp += 25;
      stats.hp = stats.maxHp;
      stats.maxMp += 15;
      stats.mp = stats.maxMp;
      stats.attack += 5;
      stats.defense += 2;

      if (transform) {
        this.spawnFloatingText(
          world,
          transform.x + 4,
          transform.y - 20,
          `LEVEL UP! (Lv.${stats.level})`,
          '#e3b341',
          true
        );
      }
    }
  }

  /**
   * Meminum HP Potion untuk memulihkan 50 HP.
   */
  public useHpPotion(stats: StatsComponent): boolean {
    if (stats.hpPotions <= 0 || stats.hp >= stats.maxHp) return false;

    stats.hpPotions--;
    stats.hp = Math.min(stats.maxHp, stats.hp + 50);
    return true;
  }

  /**
   * Meminum MP Potion untuk memulihkan 35 MP.
   */
  public useMpPotion(stats: StatsComponent): boolean {
    if (stats.mpPotions <= 0 || stats.mp >= stats.maxMp) return false;

    stats.mpPotions--;
    stats.mp = Math.min(stats.maxMp, stats.mp + 35);
    return true;
  }

  /**
   * Helper internal untuk memunculkan entitas teks floating di dunia game.
   */
  public spawnFloatingText(
    world: World,
    x: number,
    y: number,
    text: string,
    color: string = '#ffffff',
    isCrit: boolean = false
  ): Entity {
    const entity = world.createEntity();
    world.addComponent(entity, new TransformComponent(x, y));
    world.addComponent(entity, new FloatingTextComponent(text, color, isCrit));
    return entity;
  }

  private getDistance(a: TransformComponent, b: TransformComponent): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
