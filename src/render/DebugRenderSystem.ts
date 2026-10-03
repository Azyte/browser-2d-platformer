import type { Entity } from '../ecs/Entity';
import type { World } from '../ecs/World';
import type { Camera2D } from './Camera2D';
import { TransformComponent } from '../physics/TransformComponent';
import { VelocityComponent } from '../physics/VelocityComponent';
import { ColliderComponent, SolidObstacleComponent } from '../physics/PhysicsComponents';
import { MonsterAIComponent } from '../rpg/RPGComponents';
import type { AABB } from '../physics/AABB';

export interface DebugColliderInfo {
  entity: Entity;
  bounds: AABB;
}

export interface DebugMonsterAIInfo {
  entity: Entity;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  aggroRadius: number;
  leashRadius: number;
  state: string;
  targetPos: { x: number; y: number } | null;
}

/**
 * DebugRenderSystem merender visualisasi internal engine (Bounding Box AABB,
 * radius Aggro & Leashing AI monster, serta vektor kecepatan).
 * Diaktifkan dengan menekan tombol F3 atau melalui UI toggle.
 */
export class DebugRenderSystem {
  public isEnabled: boolean = false;

  /**
   * Menyalakan atau mematikan visualisasi debug.
   */
  public toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  /**
   * Mengumpulkan data kotak tabrakan (collider bounds) di dalam dunia game.
   */
  public inspectColliders(world: World): {
    solidColliders: DebugColliderInfo[];
    movingColliders: DebugColliderInfo[];
  } {
    const solidEntities = world.query(TransformComponent, ColliderComponent, SolidObstacleComponent);
    const allColliderEntities = world.query(TransformComponent, ColliderComponent);

    const solidColliders: DebugColliderInfo[] = [];
    const movingColliders: DebugColliderInfo[] = [];

    const solidSet = new Set(solidEntities);

    for (const ent of allColliderEntities) {
      const trans = world.getComponent(ent, TransformComponent);
      const col = world.getComponent(ent, ColliderComponent);
      if (!trans || !col) continue;

      const bounds = col.getBounds(trans.x, trans.y);
      // Buat salinan bounds agar aman diinspeksi
      const boxCopy = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        minX: bounds.minX,
        minY: bounds.minY,
        maxX: bounds.maxX,
        maxY: bounds.maxY,
        intersects: bounds.intersects.bind(bounds),
      };

      if (solidSet.has(ent)) {
        solidColliders.push({ entity: ent, bounds: boxCopy as AABB });
      } else {
        movingColliders.push({ entity: ent, bounds: boxCopy as AABB });
      }
    }

    return { solidColliders, movingColliders };
  }

  /**
   * Mengumpulkan data radius deteksi dan leashing AI monster.
   */
  public inspectMonsterAI(world: World): DebugMonsterAIInfo[] {
    const mobs = world.query(MonsterAIComponent, TransformComponent);
    const result: DebugMonsterAIInfo[] = [];

    for (const mob of mobs) {
      const ai = world.getComponent(mob, MonsterAIComponent);
      const trans = world.getComponent(mob, TransformComponent);
      if (!ai || !trans) continue;

      let targetPos: { x: number; y: number } | null = null;
      if (ai.targetEntity) {
        const tTrans = world.getComponent(ai.targetEntity, TransformComponent);
        if (tTrans) {
          targetPos = { x: tTrans.x, y: tTrans.y };
        }
      }

      result.push({
        entity: mob,
        x: trans.x,
        y: trans.y,
        homeX: ai.homeX,
        homeY: ai.homeY,
        aggroRadius: ai.aggroRadius,
        leashRadius: ai.leashRadius,
        state: ai.state,
        targetPos,
      });
    }

    return result;
  }

  /**
   * Merender overlay visualisasi debug ke canvas.
   */
  public render(
    world: World,
    ctx: CanvasRenderingContext2D,
    camera: Camera2D,
    alpha: number = 1.0
  ): void {
    if (!this.isEnabled) return;

    ctx.save();
    // Translasi kamera untuk elemen koordinat dunia
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

    // 1. Gambar Bounding Box Collider Padat (Merah)
    const solidEntities = world.query(TransformComponent, ColliderComponent, SolidObstacleComponent);
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(248, 81, 73, 0.18)';

    for (const ent of solidEntities) {
      const trans = world.getComponent(ent, TransformComponent);
      const col = world.getComponent(ent, ColliderComponent);
      if (!trans || !col) continue;

      const bx = trans.x + col.offsetX;
      const by = trans.y + col.offsetY;

      if (!camera.isVisible(bx - 10, by - 10, col.width + 20, col.height + 20)) continue;

      ctx.fillRect(bx, by, col.width, col.height);
      ctx.strokeRect(bx, by, col.width, col.height);

      ctx.fillStyle = '#f85149';
      ctx.font = '8px monospace';
      ctx.fillText(`${col.width}x${col.height}`, bx + 2, by + 9);
      ctx.fillStyle = 'rgba(248, 81, 73, 0.18)';
    }

    // 2. Gambar Bounding Box Entitas Bergerak (Hijau)
    const movingEntities = world.query(TransformComponent, ColliderComponent, VelocityComponent);
    ctx.strokeStyle = '#3fb950';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(63, 185, 80, 0.18)';

    for (const ent of movingEntities) {
      const trans = world.getComponent(ent, TransformComponent);
      const col = world.getComponent(ent, ColliderComponent);
      const vel = world.getComponent(ent, VelocityComponent);
      if (!trans || !col) continue;

      const rx = trans.prevX + (trans.x - trans.prevX) * alpha;
      const ry = trans.prevY + (trans.y - trans.prevY) * alpha;
      const bx = rx + col.offsetX;
      const by = ry + col.offsetY;

      ctx.fillRect(bx, by, col.width, col.height);
      ctx.strokeRect(bx, by, col.width, col.height);

      // Garis vektor kecepatan (Velocity vector arrow)
      if (vel && (vel.vx !== 0 || vel.vy !== 0)) {
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + col.width / 2, by + col.height / 2);
        ctx.lineTo(bx + col.width / 2 + vel.vx * 0.15, by + col.height / 2 + vel.vy * 0.15);
        ctx.stroke();
        ctx.strokeStyle = '#3fb950';
      }
    }

    // 3. Gambar AI Circles (Radius Aggro Kuning & Radius Leash Oranye)
    const aiMobs = this.inspectMonsterAI(world);
    for (const mob of aiMobs) {
      if (!camera.isVisible(mob.x - mob.leashRadius, mob.y - mob.leashRadius, mob.leashRadius * 2, mob.leashRadius * 2)) {
        continue;
      }

      // Radius Aggro (Kuning putus-putus)
      ctx.save();
      ctx.strokeStyle = '#f0c674';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(mob.x + 16, mob.y + 16, mob.aggroRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Radius Leash dari Home Point (Oranye)
      ctx.strokeStyle = '#f0883e';
      ctx.beginPath();
      ctx.arc(mob.homeX + 16, mob.homeY + 16, mob.leashRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Titik Sarang (Home)
      ctx.fillStyle = '#f0883e';
      ctx.fillRect(mob.homeX + 14, mob.homeY + 14, 4, 4);

      // Garis ke target jika sedang mengejar
      if (mob.targetPos) {
        ctx.strokeStyle = '#ff7b72';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(mob.x + 16, mob.y + 16);
        ctx.lineTo(mob.targetPos.x + 16, mob.targetPos.y + 16);
        ctx.stroke();
      }

      // Label status FSM di atas monster
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(`[FSM: ${mob.state.toUpperCase()}]`, mob.x - 4, mob.y - 22);

      ctx.restore();
    }

    ctx.restore();

    // 4. Panel Info Debug di Layar (Screen Space)
    ctx.save();
    ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
    ctx.fillRect(camera.viewportWidth / 2 - 140, 10, 280, 22);
    ctx.strokeStyle = '#388bfd';
    ctx.lineWidth = 1;
    ctx.strokeRect(camera.viewportWidth / 2 - 140, 10, 280, 22);

    ctx.fillStyle = '#58a6ff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚙️ F3 DEBUG: Hitboxes, AI Circles & Vectors Active', camera.viewportWidth / 2, 24);
    ctx.restore();
  }
}
