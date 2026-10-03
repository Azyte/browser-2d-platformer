import type { World } from '../ecs/World';
import type { System } from '../ecs/System';
import { TransformComponent } from '../physics/TransformComponent';
import { VelocityComponent } from '../physics/VelocityComponent';
import {
  ColliderComponent,
  SolidObstacleComponent,
} from '../physics/PhysicsComponents';

export interface TopDownMovementOptions {
  worldWidth?: number;
  worldHeight?: number;
}

/**
 * TopDownMovementSystem menangani pergerakan 8 arah di dunia top-down 2D
 * dengan algoritma sliding collision terpisah pada sumbu X dan Y.
 */
export class TopDownMovementSystem implements System {
  public worldWidth: number;
  public worldHeight: number;

  constructor(options?: TopDownMovementOptions) {
    this.worldWidth = options?.worldWidth ?? 3000;
    this.worldHeight = options?.worldHeight ?? 3000;
  }

  /**
   * Pembaruan pergerakan top-down pada fixed timestep.
   */
  public update(world: World, dt: number): void {
    const solidEntities = world.query(
      TransformComponent,
      ColliderComponent,
      SolidObstacleComponent
    );

    const movingEntities = world.query(
      TransformComponent,
      VelocityComponent,
      ColliderComponent
    );

    for (const entity of movingEntities) {
      const transform = world.getComponent(entity, TransformComponent);
      const velocity = world.getComponent(entity, VelocityComponent);
      const collider = world.getComponent(entity, ColliderComponent);

      if (!transform || !velocity || !collider) continue;

      // 1. Simpan koordinat sebelum pergerakan baru untuk interpolasi render
      transform.prevX = transform.x;
      transform.prevY = transform.y;

      // 2. Pergerakan dan Resolusi Sumbu X (Horizontal)
      transform.x += velocity.vx * dt;
      let entityBox = collider.getBounds(transform.x, transform.y);

      for (const solidEntity of solidEntities) {
        if (solidEntity === entity) continue;

        const solidTransform = world.getComponent(solidEntity, TransformComponent);
        const solidCollider = world.getComponent(solidEntity, ColliderComponent);
        if (!solidTransform || !solidCollider || !solidCollider.isSolid) continue;

        const obstacleBox = solidCollider.getBounds(solidTransform.x, solidTransform.y);

        if (entityBox.intersects(obstacleBox)) {
          // Tabrakan horizontal: hentikan laju X dan geser ke tepi rintangan (sliding effect)
          if (velocity.vx > 0) {
            transform.x = obstacleBox.minX - collider.width - collider.offsetX;
          } else if (velocity.vx < 0) {
            transform.x = obstacleBox.maxX - collider.offsetX;
          }

          velocity.vx = 0;
          entityBox = collider.getBounds(transform.x, transform.y);
        }
      }

      // 3. Pergerakan dan Resolusi Sumbu Y (Vertikal)
      // ⚠️ EDGE CASE (Sliding Collision): Memisahkan pergerakan sumbu Y memungkinkan karakter
      // tetap meluncur di sepanjang dinding jika menabrak secara miring/diagonal.
      transform.y += velocity.vy * dt;
      entityBox = collider.getBounds(transform.x, transform.y);

      for (const solidEntity of solidEntities) {
        if (solidEntity === entity) continue;

        const solidTransform = world.getComponent(solidEntity, TransformComponent);
        const solidCollider = world.getComponent(solidEntity, ColliderComponent);
        if (!solidTransform || !solidCollider || !solidCollider.isSolid) continue;

        const obstacleBox = solidCollider.getBounds(solidTransform.x, solidTransform.y);

        if (entityBox.intersects(obstacleBox)) {
          // Tabrakan vertikal: hentikan laju Y dan geser ke tepi rintangan
          if (velocity.vy > 0) {
            transform.y = obstacleBox.minY - collider.height - collider.offsetY;
          } else if (velocity.vy < 0) {
            transform.y = obstacleBox.maxY - collider.offsetY;
          }

          velocity.vy = 0;
          entityBox = collider.getBounds(transform.x, transform.y);
        }
      }

      // 4. Clamping batas terluar level dunia
      transform.x = Math.max(0, Math.min(this.worldWidth - collider.width, transform.x));
      transform.y = Math.max(0, Math.min(this.worldHeight - collider.height, transform.y));
    }
  }
}
