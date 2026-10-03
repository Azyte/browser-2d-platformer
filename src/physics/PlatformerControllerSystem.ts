import type { World } from '../ecs/World';
import type { System } from '../ecs/System';
import type { InputManager } from '../core/InputManager';
import { VelocityComponent } from './VelocityComponent';
import { RigidBodyComponent } from './PhysicsComponents';
import { PlatformerControllerComponent } from './PlatformerControllerComponent';

/**
 * PlatformerControllerSystem menangani kontrol responsif ala game platformer modern:
 * Coyote Time, Jump Buffering, Variable Jump Height, dan Kinematic Acceleration/Deceleration.
 */
export class PlatformerControllerSystem implements System {
  constructor(private readonly input: InputManager) {}

  public update(world: World, dt: number): void {
    const players = world.query(
      VelocityComponent,
      RigidBodyComponent,
      PlatformerControllerComponent
    );

    for (const entity of players) {
      const vel = world.getComponent(entity, VelocityComponent);
      const body = world.getComponent(entity, RigidBodyComponent);
      const ctrl = world.getComponent(entity, PlatformerControllerComponent);

      if (!vel || !body || !ctrl) continue;

      // 1. Kelola Coyote Time: Memberi toleransi waktu melompat sesaat setelah meninggalkan platform
      if (body.isGrounded) {
        ctrl.coyoteTimer = ctrl.coyoteDuration;
        ctrl.isJumping = false;
      } else {
        ctrl.coyoteTimer = Math.max(0, ctrl.coyoteTimer - dt);
      }

      // 2. Kelola Jump Buffering: Menyimpan input lompat sesaat sebelum mendarat di tanah
      if (this.input.isActionJustPressed('jump')) {
        ctrl.jumpBufferTimer = ctrl.jumpBufferDuration;
      } else {
        ctrl.jumpBufferTimer = Math.max(0, ctrl.jumpBufferTimer - dt);
      }

      // 3. Eksekusi Lompatan: Terjadi jika toleransi pendaratan dan input buffer keduanya valid
      if (ctrl.coyoteTimer > 0 && ctrl.jumpBufferTimer > 0) {
        vel.vy = -ctrl.jumpForce;
        // ⚠️ EDGE CASE: Reset kedua timer ke 0 agar lompatan tidak terpicu ganda (double jump bug)
        ctrl.coyoteTimer = 0;
        ctrl.jumpBufferTimer = 0;
        ctrl.isJumping = true;
        body.isGrounded = false;
      }

      // 4. Variable Jump Height: Memotong tinggi lompatan jika tombol dilepas lebih awal (short hop)
      // ⚠️ EDGE CASE: Hanya potong kecepatan jika karakter masih bergerak ke atas (vel.vy < 0)
      if (this.input.isActionJustReleased('jump') && vel.vy < 0 && ctrl.isJumping) {
        vel.vy *= ctrl.jumpCutMultiplier;
        ctrl.isJumping = false;
      }

      // 5. Pergerakan Horizontal Kinematic (Akselerasi dan Deselerasi Mulus)
      let targetDirection = 0;
      if (this.input.isActionDown('left')) targetDirection -= 1;
      if (this.input.isActionDown('right')) targetDirection += 1;

      const targetVx = targetDirection * ctrl.moveSpeed;

      // Pilih tingkat akselerasi/deselerasi berdasarkan apakah karakter di tanah atau di udara
      const rate =
        targetDirection !== 0
          ? body.isGrounded
            ? ctrl.acceleration
            : ctrl.airAcceleration
          : body.isGrounded
            ? ctrl.deceleration
            : ctrl.airDeceleration;

      if (vel.vx < targetVx) {
        vel.vx = Math.min(vel.vx + rate * dt, targetVx);
      } else if (vel.vx > targetVx) {
        vel.vx = Math.max(vel.vx - rate * dt, targetVx);
      }
    }
  }
}
