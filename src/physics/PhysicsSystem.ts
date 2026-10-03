import type { World } from '../ecs/World';
import type { System } from '../ecs/System';
import { TransformComponent } from './TransformComponent';
import { VelocityComponent } from './VelocityComponent';
import {
  ColliderComponent,
  RigidBodyComponent,
  SolidObstacleComponent,
} from './PhysicsComponents';

export interface PhysicsSystemOptions {
  /** Nilai percepatan gravitasi dunia dalam pixel/detik^2 (default: 980). */
  gravity?: number;
}

/**
 * PhysicsSystem mengelola simulasi fisika 2D: gravitasi, integrasi kecepatan,
 * dan resolusi tabrakan AABB per-sumbu (X lalu Y) untuk mencegah corner snagging.
 */
export class PhysicsSystem implements System {
  public gravity: number;

  constructor(options?: PhysicsSystemOptions) {
    this.gravity = options?.gravity ?? 980;
  }

  /**
   * Siklus pembaruan fisika pada fixed timestep.
   * @param world Instance World ECS
   * @param dt Delta time konstan (detik)
   */
  public update(world: World, dt: number): void {
    const solidEntities = world.query(
      TransformComponent,
      ColliderComponent,
      SolidObstacleComponent
    );

    const dynamicEntities = world.query(
      TransformComponent,
      VelocityComponent,
      ColliderComponent,
      RigidBodyComponent
    );

    for (const entity of dynamicEntities) {
      const transform = world.getComponent(entity, TransformComponent);
      const velocity = world.getComponent(entity, VelocityComponent);
      const collider = world.getComponent(entity, ColliderComponent);
      const body = world.getComponent(entity, RigidBodyComponent);

      if (!transform || !velocity || !collider || !body) continue;

      // 1. Simpan koordinat sebelum pergerakan baru untuk interpolasi render
      transform.prevX = transform.x;
      transform.prevY = transform.y;

      // 2. Terapkan percepatan gravitasi
      if (body.useGravity) {
        velocity.vy += this.gravity * body.gravityScale * dt;

        // ⚠️ EDGE CASE: Terminal Velocity. Tanpa pembatasan batas atas kecepatan jatuh,
        // karakter yang jatuh bebas dalam waktu lama akan mencapai kecepatan ribuan pixel/frame
        // dan berisiko menembus lantai (tunneling).
        if (velocity.vy > body.terminalVelocity) {
          velocity.vy = body.terminalVelocity;
        }
      }

      // Reset status kontak sebelum evaluasi collision tick ini
      body.isGrounded = false;
      body.isCollidingHorizontally = false;

      // 3. Pergerakan dan Resolusi Tabrakan Sumbu X (Horizontal)
      transform.x += velocity.vx * dt;
      let playerBox = collider.getBounds(transform.x, transform.y);

      for (const solidEntity of solidEntities) {
        if (solidEntity === entity) continue;

        const solidTransform = world.getComponent(solidEntity, TransformComponent);
        const solidCollider = world.getComponent(solidEntity, ColliderComponent);
        if (!solidTransform || !solidCollider || !solidCollider.isSolid) continue;

        const obstacleBox = solidCollider.getBounds(solidTransform.x, solidTransform.y);

        if (playerBox.intersects(obstacleBox)) {
          body.isCollidingHorizontally = true;

          if (velocity.vx > 0) {
            // Bergerak ke kanan: dorong kembali ke sisi kiri rintangan
            transform.x = obstacleBox.minX - collider.width - collider.offsetX;
          } else if (velocity.vx < 0) {
            // Bergerak ke kiri: dorong kembali ke sisi kanan rintangan
            transform.x = obstacleBox.maxX - collider.offsetX;
          }

          velocity.vx = 0;
          playerBox = collider.getBounds(transform.x, transform.y);
        }
      }

      // 4. Pergerakan dan Resolusi Tabrakan Sumbu Y (Vertikal)
      // ⚠️ EDGE CASE: Memisahkan pergerakan sumbu X dan Y adalah standar emas 2D platformer.
      // Jika diselesaikan bersamaan di satu diagonal step, karakter yang berjalan di lantai
      // datar akan sering tersangkut di garis sambungan antar ubin (tile seams).
      transform.y += velocity.vy * dt;
      playerBox = collider.getBounds(transform.x, transform.y);

      for (const solidEntity of solidEntities) {
        if (solidEntity === entity) continue;

        const solidTransform = world.getComponent(solidEntity, TransformComponent);
        const solidCollider = world.getComponent(solidEntity, ColliderComponent);
        if (!solidTransform || !solidCollider || !solidCollider.isSolid) continue;

        const obstacleBox = solidCollider.getBounds(solidTransform.x, solidTransform.y);

        if (playerBox.intersects(obstacleBox)) {
          if (velocity.vy > 0) {
            // Jatuh ke bawah: mendarat di permukaan atas lantai
            transform.y = obstacleBox.minY - collider.height - collider.offsetY;
            body.isGrounded = true;
            velocity.vy = 0;
          } else if (velocity.vy < 0) {
            // Melompat ke atas: kepala membentur langit-langit
            transform.y = obstacleBox.maxY - collider.offsetY;
            velocity.vy = 0;
          }

          playerBox = collider.getBounds(transform.x, transform.y);
        }
      }
    }
  }
}
