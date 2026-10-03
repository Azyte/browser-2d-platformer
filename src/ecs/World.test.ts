import { describe, it, expect, vi } from 'vitest';
import { World } from './World';
import type { System } from './System';

// Komponen uji coba
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public vx: number = 0, public vy: number = 0) {}
}

class Health {
  constructor(public current: number = 100) {}
}

describe('ECS World', () => {
  it('harus membuat entitas dengan ID inkremental yang unik', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();

    expect(e1).toBeDefined();
    expect(e2).toBeDefined();
    expect(e1).not.toBe(e2);
    expect(world.isAlive(e1)).toBe(true);
    expect(world.isAlive(e2)).toBe(true);
    expect(world.entityCount).toBe(2);
  });

  it('harus dapat menambah, membaca, memeriksa, dan menghapus komponen', () => {
    const world = new World();
    const entity = world.createEntity();

    world.addComponent(entity, new Position(10, 20));
    expect(world.hasComponent(entity, Position)).toBe(true);

    const pos = world.getComponent(entity, Position);
    expect(pos).toBeDefined();
    expect(pos?.x).toBe(10);
    expect(pos?.y).toBe(20);

    world.removeComponent(entity, Position);
    expect(world.hasComponent(entity, Position)).toBe(false);
    expect(world.getComponent(entity, Position)).toBeUndefined();
  });

  it('harus melakukan query entitas berdasarkan kombinasi komponen dengan benar', () => {
    const world = new World();

    // Entitas 1: Position & Velocity (bergerak)
    const e1 = world.createEntity();
    world.addComponent(e1, new Position(0, 0));
    world.addComponent(e1, new Velocity(5, 5));

    // Entitas 2: Hanya Position (statis)
    const e2 = world.createEntity();
    world.addComponent(e2, new Position(50, 50));

    // Entitas 3: Position, Velocity, Health (karakter pemain)
    const e3 = world.createEntity();
    world.addComponent(e3, new Position(100, 100));
    world.addComponent(e3, new Velocity(10, 0));
    world.addComponent(e3, new Health(100));

    // Query untuk objek yang memiliki Position dan Velocity
    const movingEntities = world.query(Position, Velocity);
    expect(movingEntities).toContain(e1);
    expect(movingEntities).toContain(e3);
    expect(movingEntities).not.toContain(e2);
    expect(movingEntities.length).toBe(2);

    // Query untuk objek yang memiliki Health
    const livingEntities = world.query(Health);
    expect(livingEntities).toEqual([e3]);

    // Query untuk komponen yang tidak pernah didaftarkan entitas apapun
    class UnusedComponent {}
    expect(world.query(UnusedComponent)).toEqual([]);
  });

  it('harus membersihkan seluruh komponen saat entitas dimusnahkan secara langsung', () => {
    const world = new World();
    const entity = world.createEntity();
    world.addComponent(entity, new Position(10, 10));
    world.addComponent(entity, new Velocity(1, 1));

    world.destroyEntity(entity);

    expect(world.isAlive(entity)).toBe(false);
    expect(world.entityCount).toBe(0);
    expect(world.getComponent(entity, Position)).toBeUndefined();
    expect(world.query(Position)).toEqual([]);
  });

  it('harus menangani queueDestroy secara tertunda pada fase update (anti-crash iterasi)', () => {
    const world = new World();
    const entity = world.createEntity();
    world.addComponent(entity, new Position(0, 0));

    world.queueDestroy(entity);

    // Saat masih dalam tick (sebelum update selesai diproses), entitas sudah tidak dianggap alive
    expect(world.isAlive(entity)).toBe(false);

    // Jalankan update untuk memicu flushDestroyQueue
    world.update(1 / 60);

    expect(world.entityCount).toBe(0);
    expect(world.getComponent(entity, Position)).toBeUndefined();
  });

  it('harus memanggil update dan render pada sistem yang terdaftar', () => {
    const world = new World();
    const mockUpdate = vi.fn();
    const mockRender = vi.fn();

    const testSystem: System = {
      update: mockUpdate,
      render: mockRender,
    };

    world.addSystem(testSystem);

    world.update(0.016);
    expect(mockUpdate).toHaveBeenCalledWith(world, 0.016);

    world.render(0.75);
    expect(mockRender).toHaveBeenCalledWith(world, 0.75);
  });
});
