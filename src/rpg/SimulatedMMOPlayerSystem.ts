import type { World } from '../ecs/World';
import type { Entity } from '../ecs/Entity';
import type { System } from '../ecs/System';
import { TransformComponent } from '../physics/TransformComponent';
import { VelocityComponent } from '../physics/VelocityComponent';
import {
  StatsComponent,
  CombatComponent,
  NameplateComponent,
  MonsterAIComponent,
  SimulatedPlayerComponent,
} from './RPGComponents';
import type { CombatSystem } from './CombatSystem';
import type { ChatManager } from './ChatSystem';

const RANDOM_CHAT_MESSAGES = [
  'LFG dungeon run, need 1 tank!',
  'Selling iron sword +2, whisper me.',
  'Hati-hati, ada monster elite di dekat danau!',
  'Nice hit! Level berapa sekarang?',
  'Ada yang punya stok mana potion lebih?',
  'Lag barusan ya? Atau koneksi gw yang drop?',
  'Farming slime buat kumpulin gold dulu.',
  'Ggwp monster conquered!',
];

/**
 * SimulatedMMOPlayerSystem mengendalikan AI bot pemain lain:
 * Berkelana secara otonom, mencari dan memburu monster, memakai potion, dan mengirim pesan chat.
 */
export class SimulatedMMOPlayerSystem implements System {
  public moveSpeed: number = 135;

  constructor(
    private readonly combatSystem: CombatSystem,
    private readonly chatManager: ChatManager
  ) {}

  public update(world: World, dt: number): void {
    const bots = world.query(
      TransformComponent,
      VelocityComponent,
      StatsComponent,
      CombatComponent,
      NameplateComponent,
      SimulatedPlayerComponent
    );

    const monsters = world.query(
      TransformComponent,
      StatsComponent,
      MonsterAIComponent
    );

    for (const bot of bots) {
      const transform = world.getComponent(bot, TransformComponent);
      const velocity = world.getComponent(bot, VelocityComponent);
      const stats = world.getComponent(bot, StatsComponent);
      const combat = world.getComponent(bot, CombatComponent);
      const nameplate = world.getComponent(bot, NameplateComponent);
      const botComp = world.getComponent(bot, SimulatedPlayerComponent);

      if (!transform || !velocity || !stats || !combat || !nameplate || !botComp) {
        continue;
      }

      // 1. Potion Emergency Survival: Minum HP potion jika darah di bawah 35%
      if (stats.hp < stats.maxHp * 0.35 && stats.hpPotions > 0) {
        if (this.combatSystem.useHpPotion(stats)) {
          this.chatManager.addMessage(
            nameplate.name,
            `Minum potion! HP pulih ke ${stats.hp}`,
            'other_player'
          );
        }
      }

      // 2. Chatting Otonom
      botComp.chatCooldown -= dt;
      if (botComp.chatCooldown <= 0) {
        const randomMsg =
          RANDOM_CHAT_MESSAGES[Math.floor(Math.random() * RANDOM_CHAT_MESSAGES.length)];
        this.chatManager.addMessage(nameplate.name, randomMsg, 'other_player');
        botComp.chatCooldown = 8.0 + Math.random() * 8.0; // Reset 8-16 detik
      }

      // 3. Cari Target Monster yang masih hidup jika belum punya
      if (
        !botComp.targetMonster ||
        !this.isMonsterAlive(world, botComp.targetMonster)
      ) {
        botComp.targetMonster = this.findClosestMonster(transform, world, monsters);
      }

      // 4. Pergerakan dan Pertarungan
      if (botComp.targetMonster) {
        const monsterTransform = world.getComponent(botComp.targetMonster, TransformComponent);
        const monsterStats = world.getComponent(botComp.targetMonster, StatsComponent);

        if (!monsterTransform || !monsterStats || monsterStats.hp <= 0) {
          botComp.targetMonster = null;
          velocity.vx = 0;
          velocity.vy = 0;
          continue;
        }

        const dist = this.getDistance(
          transform.x,
          transform.y,
          monsterTransform.x,
          monsterTransform.y
        );

        if (dist > combat.attackRange) {
          // Gerak mendekati monster
          const angle = Math.atan2(
            monsterTransform.y - transform.y,
            monsterTransform.x - transform.x
          );
          velocity.vx = Math.cos(angle) * this.moveSpeed;
          velocity.vy = Math.sin(angle) * this.moveSpeed;
        } else {
          // Dalam jangkauan serang: berhenti dan serang
          velocity.vx = 0;
          velocity.vy = 0;

          // Coba gunakan skill terlebih dahulu jika mana dan cooldown siap
          if (
            combat.currentSkillCooldown <= 0 &&
            stats.mp >= combat.skillCostMp
          ) {
            this.combatSystem.executeSkill(world, bot, botComp.targetMonster);
          } else {
            this.combatSystem.executeBasicAttack(world, bot, botComp.targetMonster);
          }

          // Cek jika monster terbunuh oleh serangan bot
          if (monsterStats.hp <= 0) {
            this.combatSystem.rewardExp(world, bot, 35);
            botComp.targetMonster = null;
          }
        }
      } else {
        // Tidak ada monster di sekitar: diam
        velocity.vx = 0;
        velocity.vy = 0;
      }
    }
  }

  private isMonsterAlive(world: World, monster: Entity): boolean {
    const stats = world.getComponent(monster, StatsComponent);
    return stats !== undefined && stats.hp > 0;
  }

  private findClosestMonster(
    botTransform: TransformComponent,
    world: World,
    monsters: Entity[]
  ): Entity | null {
    let closestEntity: Entity | null = null;
    let minDistance = Infinity;

    for (const monster of monsters) {
      const stats = world.getComponent(monster, StatsComponent);
      const transform = world.getComponent(monster, TransformComponent);

      if (!stats || !transform || stats.hp <= 0) continue;

      const dist = this.getDistance(
        botTransform.x,
        botTransform.y,
        transform.x,
        transform.y
      );

      if (dist < minDistance) {
        minDistance = dist;
        closestEntity = monster;
      }
    }

    return closestEntity;
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
