import type { Entity } from '../ecs/Entity';
import type { World } from '../ecs/World';
import type { System } from '../ecs/System';
import { TransformComponent } from '../physics/TransformComponent';
import { VelocityComponent } from '../physics/VelocityComponent';
import {
  StatsComponent,
  CombatComponent,
  NameplateComponent,
  MonsterAIComponent,
} from './RPGComponents';
import type { CombatSystem } from './CombatSystem';

/**
 * MonsterAISystem mengelola perilaku monster liar:
 * Idle, Patroli di sekitar sarang, Pengejaran (Chase), Serangan, dan Leashing (Return ke sarang).
 */
export class MonsterAISystem implements System {
  public patrolSpeed: number = 40;
  public chaseSpeed: number = 95;
  public respawnDuration: number = 20.0; // Waktu hidup kembali setelah mati diperpanjang dari 5.0s ke 20.0s

  constructor(private readonly combatSystem: CombatSystem) {}

  public update(world: World, dt: number): void {
    const monsters = world.query(
      TransformComponent,
      VelocityComponent,
      StatsComponent,
      CombatComponent,
      MonsterAIComponent
    );

    const playersAndBots = world.query(
      TransformComponent,
      StatsComponent,
      NameplateComponent
    );

    for (const monster of monsters) {
      const transform = world.getComponent(monster, TransformComponent);
      const velocity = world.getComponent(monster, VelocityComponent);
      const stats = world.getComponent(monster, StatsComponent);
      const combat = world.getComponent(monster, CombatComponent);
      const ai = world.getComponent(monster, MonsterAIComponent);

      if (!transform || !velocity || !stats || !combat || !ai) continue;

      // 1. Tangani Monster Mati
      if (stats.hp <= 0) {
        velocity.vx = 0;
        velocity.vy = 0;
        ai.state = 'idle';
        ai.targetEntity = null;
        ai.stateTimer += dt;

        // Respawn jika durasi telah tercapai
        if (ai.stateTimer >= this.respawnDuration) {
          stats.hp = stats.maxHp;
          transform.x = ai.homeX;
          transform.y = ai.homeY;
          ai.stateTimer = 0;
        }
        continue;
      }

      // 2. Evaluasi deteksi target di sekitar jika monster belum memiliki target aktif
      if (ai.state === 'idle' || ai.state === 'patrol') {
        this.searchTarget(world, monster, transform, ai, playersAndBots);
      }

      // 3. State Machine Monster Hidup
      switch (ai.state) {
        case 'idle': {
          velocity.vx = 0;
          velocity.vy = 0;
          ai.stateTimer -= dt;

          if (ai.stateTimer <= 0) {
            ai.state = 'patrol';
            ai.stateTimer = 2.0;
          }
          break;
        }

        case 'patrol': {
          ai.stateTimer -= dt;

          const distHome = this.getDistance(transform.x, transform.y, ai.homeX, ai.homeY);
          if (distHome > 80) {
            const angle = Math.atan2(ai.homeY - transform.y, ai.homeX - transform.x);
            velocity.vx = Math.cos(angle) * this.patrolSpeed;
            velocity.vy = Math.sin(angle) * this.patrolSpeed;
          }

          if (ai.stateTimer <= 0) {
            ai.state = 'idle';
            ai.stateTimer = 1.5;
            velocity.vx = 0;
            velocity.vy = 0;
          }
          break;
        }

        case 'chase': {
          // ⚠️ EDGE CASE (Anti-kiting Leash): Jika monster terpancing terlalu jauh dari sarang,
          // batalkan pengejaran dan lari kembali ke sarang (Return).
          const distHome = this.getDistance(transform.x, transform.y, ai.homeX, ai.homeY);
          if (distHome > ai.leashRadius || !ai.targetEntity) {
            ai.state = 'return';
            ai.targetEntity = null;
            this.applyReturnVelocity(transform, velocity, ai);
            break;
          }

          const targetTransform = world.getComponent(ai.targetEntity, TransformComponent);
          const targetStats = world.getComponent(ai.targetEntity, StatsComponent);

          if (!targetTransform || !targetStats || targetStats.hp <= 0) {
            ai.state = 'return';
            ai.targetEntity = null;
            this.applyReturnVelocity(transform, velocity, ai);
            break;
          }

          const distTarget = this.getDistance(
            transform.x,
            transform.y,
            targetTransform.x,
            targetTransform.y
          );

          if (distTarget <= combat.attackRange) {
            ai.state = 'attack';
            velocity.vx = 0;
            velocity.vy = 0;
          } else {
            const angle = Math.atan2(
              targetTransform.y - transform.y,
              targetTransform.x - transform.x
            );
            velocity.vx = Math.cos(angle) * this.chaseSpeed;
            velocity.vy = Math.sin(angle) * this.chaseSpeed;
          }
          break;
        }

        case 'attack': {
          velocity.vx = 0;
          velocity.vy = 0;

          if (!ai.targetEntity) {
            ai.state = 'return';
            this.applyReturnVelocity(transform, velocity, ai);
            break;
          }

          const targetTransform = world.getComponent(ai.targetEntity, TransformComponent);
          const targetStats = world.getComponent(ai.targetEntity, StatsComponent);

          if (!targetTransform || !targetStats || targetStats.hp <= 0) {
            ai.state = 'return';
            ai.targetEntity = null;
            this.applyReturnVelocity(transform, velocity, ai);
            break;
          }

          const distTarget = this.getDistance(
            transform.x,
            transform.y,
            targetTransform.x,
            targetTransform.y
          );

          if (distTarget > combat.attackRange) {
            ai.state = 'chase';
            const angle = Math.atan2(
              targetTransform.y - transform.y,
              targetTransform.x - transform.x
            );
            velocity.vx = Math.cos(angle) * this.chaseSpeed;
            velocity.vy = Math.sin(angle) * this.chaseSpeed;
          } else {
            this.combatSystem.executeBasicAttack(world, monster, ai.targetEntity);
          }
          break;
        }

        case 'return': {
          stats.hp = Math.min(stats.maxHp, stats.hp + 20 * dt);
          this.applyReturnVelocity(transform, velocity, ai);
          break;
        }
      }
    }
  }

  private applyReturnVelocity(
    transform: TransformComponent,
    velocity: VelocityComponent,
    ai: MonsterAIComponent
  ): void {
    const distHome = this.getDistance(transform.x, transform.y, ai.homeX, ai.homeY);

    if (distHome < 8) {
      transform.x = ai.homeX;
      transform.y = ai.homeY;
      velocity.vx = 0;
      velocity.vy = 0;
      ai.state = 'idle';
      ai.stateTimer = 1.0;
    } else {
      const angle = Math.atan2(ai.homeY - transform.y, ai.homeX - transform.x);
      velocity.vx = Math.cos(angle) * this.chaseSpeed;
      velocity.vy = Math.sin(angle) * this.chaseSpeed;
    }
  }

  private searchTarget(
    world: World,
    monsterEntity: Entity,
    transform: TransformComponent,
    ai: MonsterAIComponent,
    candidates: Entity[]
  ): void {
    for (const candidate of candidates) {
      if (candidate === monsterEntity) continue;

      const nameplate = world.getComponent(candidate, NameplateComponent);
      const targetStats = world.getComponent(candidate, StatsComponent);
      const targetTransform = world.getComponent(candidate, TransformComponent);

      if (!nameplate || !targetStats || !targetTransform || targetStats.hp <= 0) {
        continue;
      }

      if (nameplate.role !== 'player' && nameplate.role !== 'other_player') {
        continue;
      }

      const dist = this.getDistance(
        transform.x,
        transform.y,
        targetTransform.x,
        targetTransform.y
      );

      if (dist <= ai.aggroRadius) {
        ai.state = 'chase';
        ai.targetEntity = candidate;
        const angle = Math.atan2(
          targetTransform.y - transform.y,
          targetTransform.x - transform.x
        );
        const velocity = world.getComponent(monsterEntity, VelocityComponent);
        if (velocity) {
          velocity.vx = Math.cos(angle) * this.chaseSpeed;
          velocity.vy = Math.sin(angle) * this.chaseSpeed;
        }
        break;
      }
    }
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
