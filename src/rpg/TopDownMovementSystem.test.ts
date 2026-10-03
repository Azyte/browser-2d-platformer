import { describe, it, expect } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import { VelocityComponent } from '../physics/VelocityComponent';
import {
  ColliderComponent,
  SolidObstacleComponent,
} from '../physics/PhysicsComponents';
import { TopDownMovementSystem } from './TopDownMovementSystem';

describe('TopDownMovementSystem', () => {
  it('harus memindahkan posisi entitas di sumbu X dan Y berdasarkan velocity', () => {
    const world = new World();
    const movement = new TopDownMovementSystem();
    world.addSystem(movement);

    const entity = world.createEntity();
    world.addComponent(entity, new TransformComponent(10, 20));
    world.addComponent(entity, new VelocityComponent(100, 50));
    world.addComponent(entity, new ColliderComponent(24, 24));

    movement.update(world, 0.1);

    const transform = world.getComponent(entity, TransformComponent)!;
    expect(transform.x).toBe(20); // 10 + 100 * 0.1
    expect(transform.y).toBe(25); // 20 + 50 * 0.1
    expect(transform.prevX).toBe(10);
    expect(transform.prevY).toBe(20);
  });

  it('harus mendukung sliding collision saat menabrak rintangan solid (meluncur di sepanjang dinding)', () => {
    const world = new World();
    const movement = new TopDownMovementSystem();
    world.addSystem(movement);

    // Dinding vertikal solid di x: 100..130, y: 0..300
    const wall = world.createEntity();
    world.addComponent(wall, new TransformComponent(100, 0));
    world.addComponent(wall, new ColliderComponent(30, 300));
    world.addComponent(wall, new SolidObstacleComponent());

    // Karakter di x: 80, y: 50 dengan ukuran 20x20.
    // Bergerak diagonal kanan-bawah: vx = 200, vy = 100.
    // Sumbu X akan membentur dinding di x=100 (tertahan di x=80).
    // Sumbu Y bebas hambatan dan harus tetap meluncur turun (y bertambah)!
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(80, 50));
    world.addComponent(player, new VelocityComponent(200, 100));
    world.addComponent(player, new ColliderComponent(20, 20));

    movement.update(world, 0.1);

    const transform = world.getComponent(player, TransformComponent)!;
    const vel = world.getComponent(player, VelocityComponent)!;

    // Sumbu X tertahan di batas dinding (100 - 20 = 80)
    expect(transform.x).toBe(80);
    expect(vel.vx).toBe(0);

    // Sumbu Y tetap meluncur bebas ke bawah (50 + 100 * 0.1 = 60)
    expect(transform.y).toBe(60);
    expect(vel.vy).toBe(100);
  });
});
