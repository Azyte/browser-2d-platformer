import { describe, it, expect } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from './TransformComponent';
import { VelocityComponent } from './VelocityComponent';
import {
  ColliderComponent,
  RigidBodyComponent,
  SolidObstacleComponent,
} from './PhysicsComponents';
import { PhysicsSystem } from './PhysicsSystem';

describe('PhysicsSystem', () => {
  it('harus menerapkan percepatan gravitasi dan membatasi terminal velocity', () => {
    const world = new World();
    const physics = new PhysicsSystem({ gravity: 1000 });
    world.addSystem(physics);

    const entity = world.createEntity();
    world.addComponent(entity, new TransformComponent(0, 0));
    world.addComponent(entity, new VelocityComponent(0, 0));
    world.addComponent(entity, new ColliderComponent(20, 20));
    world.addComponent(
      entity,
      new RigidBodyComponent({ terminalVelocity: 500 })
    );

    // 1 tick = 0.1 detik -> vy bertambah 1000 * 0.1 = 100
    physics.update(world, 0.1);
    const vel = world.getComponent(entity, VelocityComponent)!;
    expect(vel.vy).toBe(100);

    // Jalankan 10 detik gravitasi (melebihi terminal velocity)
    physics.update(world, 10);
    expect(vel.vy).toBe(500); // Terbatasi di 500
  });

  it('harus menghentikan jatuh saat mendarat di lantai dan mengubah isGrounded menjadi true', () => {
    const world = new World();
    const physics = new PhysicsSystem({ gravity: 1000 });
    world.addSystem(physics);

    // Lantai solid di y: 100..120
    const floor = world.createEntity();
    world.addComponent(floor, new TransformComponent(0, 100));
    world.addComponent(floor, new ColliderComponent(200, 20));
    world.addComponent(floor, new SolidObstacleComponent());

    // Karakter di y: 80 dengan tinggi 20 (dasar di y=100 pas menyentuh lantai)
    // Dengan vy = 200, karakter akan mencoba menembus lantai
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(50, 80));
    world.addComponent(player, new VelocityComponent(0, 200));
    world.addComponent(player, new ColliderComponent(20, 20));
    world.addComponent(player, new RigidBodyComponent());

    physics.update(world, 0.1);

    const transform = world.getComponent(player, TransformComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;
    const body = world.getComponent(player, RigidBodyComponent)!;

    // Karakter harus diposisikan tepat di atas lantai (y = 100 - 20 = 80)
    expect(transform.y).toBe(80);
    expect(vel.vy).toBe(0);
    expect(body.isGrounded).toBe(true);
  });

  it('harus membatalkan kecepatan ke atas saat kepala membentur langit-langit', () => {
    const world = new World();
    const physics = new PhysicsSystem({ gravity: 0 });
    world.addSystem(physics);

    // Langit-langit solid di y: 20..40
    const ceiling = world.createEntity();
    world.addComponent(ceiling, new TransformComponent(0, 20));
    world.addComponent(ceiling, new ColliderComponent(200, 20));
    world.addComponent(ceiling, new SolidObstacleComponent());

    // Karakter di y: 45 melompat ke atas dengan vy = -300
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(50, 45));
    world.addComponent(player, new VelocityComponent(0, -300));
    world.addComponent(player, new ColliderComponent(20, 20));
    world.addComponent(player, new RigidBodyComponent());

    physics.update(world, 0.1);

    const transform = world.getComponent(player, TransformComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;

    // Karakter harus ditahan di bawah langit-langit (y = 40)
    expect(transform.y).toBe(40);
    expect(vel.vy).toBe(0);
  });

  it('harus memblokir pergerakan horizontal saat menabrak dinding', () => {
    const world = new World();
    const physics = new PhysicsSystem({ gravity: 0 });
    world.addSystem(physics);

    // Dinding vertikal solid di x: 100..120
    const wall = world.createEntity();
    world.addComponent(wall, new TransformComponent(100, 0));
    world.addComponent(wall, new ColliderComponent(20, 200));
    world.addComponent(wall, new SolidObstacleComponent());

    // Karakter di x: 75 bergerak ke kanan dengan vx = 200
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(75, 50));
    world.addComponent(player, new VelocityComponent(200, 0));
    world.addComponent(player, new ColliderComponent(20, 20));
    world.addComponent(player, new RigidBodyComponent());

    physics.update(world, 0.1);

    const transform = world.getComponent(player, TransformComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;
    const body = world.getComponent(player, RigidBodyComponent)!;

    // Karakter tertahan tepat di sebelah kiri dinding (x = 100 - 20 = 80)
    expect(transform.x).toBe(80);
    expect(vel.vx).toBe(0);
    expect(body.isCollidingHorizontally).toBe(true);
  });
});
