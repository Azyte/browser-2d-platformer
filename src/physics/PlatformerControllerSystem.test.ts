// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../ecs/World';
import { InputManager } from '../core/InputManager';
import { VelocityComponent } from './VelocityComponent';
import { RigidBodyComponent } from './PhysicsComponents';
import { PlatformerControllerComponent } from './PlatformerControllerComponent';
import { PlatformerControllerSystem } from './PlatformerControllerSystem';

describe('PlatformerControllerSystem (Game Feel Polish)', () => {
  let world: World;
  let input: InputManager;
  let system: PlatformerControllerSystem;

  beforeEach(() => {
    world = new World();
    input = new InputManager();
    system = new PlatformerControllerSystem(input);
  });

  afterEach(() => {
    input.stopListening();
  });

  it('harus mengizinkan lompatan sesaat setelah meninggalkan platform (Coyote Time)', () => {
    const player = world.createEntity();
    world.addComponent(player, new VelocityComponent(0, 0));
    world.addComponent(player, new RigidBodyComponent());
    world.addComponent(
      player,
      new PlatformerControllerComponent({ coyoteDuration: 0.1, jumpForce: 500 })
    );

    const body = world.getComponent(player, RigidBodyComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;

    // 1. Awalnya di tanah
    body.isGrounded = true;
    system.update(world, 0.016);

    // 2. Pemain melangkah keluar tebing (isGrounded menjadi false)
    body.isGrounded = false;
    system.update(world, 0.05); // Baru 50ms di udara (masih di bawah coyoteDuration 100ms)

    // 3. Tekan tombol lompat di udara
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    system.update(world, 0.016);

    // Lompatan harus berhasil dieksekusi!
    expect(vel.vy).toBe(-500);
  });

  it('tidak boleh mengizinkan lompat jika durasi Coyote Time telah habis', () => {
    const player = world.createEntity();
    world.addComponent(player, new VelocityComponent(0, 0));
    world.addComponent(player, new RigidBodyComponent());
    world.addComponent(
      player,
      new PlatformerControllerComponent({ coyoteDuration: 0.1, jumpForce: 500 })
    );

    const body = world.getComponent(player, RigidBodyComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;

    body.isGrounded = true;
    system.update(world, 0.016);

    // Jatuh selama 200ms (melebihi coyoteDuration 100ms)
    body.isGrounded = false;
    system.update(world, 0.2);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    system.update(world, 0.016);

    // Lompatan gagal, vy tetap 0
    expect(vel.vy).toBe(0);
  });

  it('harus mengeksekusi lompatan otomatis begitu mendarat jika tombol ditekan di udara (Jump Buffering)', () => {
    const player = world.createEntity();
    world.addComponent(player, new VelocityComponent(0, 0));
    world.addComponent(player, new RigidBodyComponent());
    world.addComponent(
      player,
      new PlatformerControllerComponent({ jumpBufferDuration: 0.15, jumpForce: 500 })
    );

    const body = world.getComponent(player, RigidBodyComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;

    // Karakter melayang di udara
    body.isGrounded = false;
    system.update(world, 0.016);

    // Pemain menekan spasi 50ms sebelum menyentuh lantai
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    system.update(world, 0.05);
    input.endFrame();

    // Di udara, lompatan belum terjadi
    expect(vel.vy).toBe(0);

    // Sekarang karakter menyentuh lantai!
    body.isGrounded = true;
    system.update(world, 0.016);

    // Jump buffer otomatis memicu lompatan tepat saat menyentuh lantai
    expect(vel.vy).toBe(-500);
  });

  it('harus memotong momentum lompatan jika tombol dilepas lebih awal (Variable Jump Height)', () => {
    const player = world.createEntity();
    world.addComponent(player, new VelocityComponent(0, 0));
    world.addComponent(player, new RigidBodyComponent());
    world.addComponent(
      player,
      new PlatformerControllerComponent({ jumpForce: 600, jumpCutMultiplier: 0.5 })
    );

    const body = world.getComponent(player, RigidBodyComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;

    // Eksekusi lompatan penuh
    body.isGrounded = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    system.update(world, 0.016);
    input.endFrame();

    expect(vel.vy).toBe(-600);

    // Lepas tombol spasi saat masih meluncur ke atas
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    system.update(world, 0.016);

    // Kecepatan ke atas terpotong setengah (-600 * 0.5 = -300)
    expect(vel.vy).toBe(-300);
  });

  it('harus melakukan akselerasi dan deselerasi kinematic secara mulus', () => {
    const player = world.createEntity();
    world.addComponent(player, new VelocityComponent(0, 0));
    world.addComponent(player, new RigidBodyComponent());
    world.addComponent(
      player,
      new PlatformerControllerComponent({ moveSpeed: 200, acceleration: 1000 })
    );

    const body = world.getComponent(player, RigidBodyComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;
    body.isGrounded = true;

    // Tekan tombol kanan
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));

    // Update 0.1 detik -> bertambah 1000 * 0.1 = 100 (belum mencapai 200)
    system.update(world, 0.1);
    expect(vel.vx).toBe(100);

    // Update 0.2 detik lagi -> mencapai batas maksimal 200
    system.update(world, 0.2);
    expect(vel.vx).toBe(200);
  });
});
