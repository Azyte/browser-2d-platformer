import { describe, it, expect } from 'vitest';
import { Vector2 } from './Vector2';
import { AABB, type CollisionManifold } from './AABB';

describe('Physics: Vector2', () => {
  it('harus melakukan operasi in-place add, sub, dan scale dengan benar', () => {
    const v = new Vector2(10, 20);
    v.add(new Vector2(5, -10));
    expect(v.x).toBe(15);
    expect(v.y).toBe(10);

    v.sub(new Vector2(5, 5));
    expect(v.x).toBe(10);
    expect(v.y).toBe(5);

    v.scale(2);
    expect(v.x).toBe(20);
    expect(v.y).toBe(10);
  });

  it('harus menghitung dot product, length, dan normalisasi secara presisi', () => {
    const v = new Vector2(3, 4);
    expect(v.lengthSq()).toBe(25);
    expect(v.length()).toBe(5);

    const v2 = new Vector2(2, 1);
    expect(v.dot(v2)).toBe(3 * 2 + 4 * 1); // 10

    v.normalize();
    expect(v.length()).toBeCloseTo(1, 4);
    expect(v.x).toBeCloseTo(3 / 5, 4);
    expect(v.y).toBeCloseTo(4 / 5, 4);
  });

  it('harus menangani normalisasi zero vector tanpa menghasilkan NaN', () => {
    const v = new Vector2(0, 0);
    v.normalize();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(isNaN(v.x)).toBe(false);
  });

  it('harus mendukung operasi statis dengan out vector untuk zero-allocation', () => {
    const a = new Vector2(1, 2);
    const b = new Vector2(3, 4);
    const out = new Vector2();

    const result = Vector2.add(a, b, out);
    expect(result).toBe(out);
    expect(out.x).toBe(4);
    expect(out.y).toBe(6);
  });
});

describe('Physics: AABB', () => {
  it('harus mendeteksi tabrakan (intersects) dengan benar', () => {
    const boxA = new AABB(0, 0, 32, 32);
    const boxB = new AABB(20, 20, 32, 32); // Irisan di (20,20) s.d (32,32)
    const boxC = new AABB(50, 50, 32, 32); // Terpisah

    expect(boxA.intersects(boxB)).toBe(true);
    expect(boxB.intersects(boxA)).toBe(true);
    expect(boxA.intersects(boxC)).toBe(false);
  });

  it('harus mendeteksi containsPoint dengan tepat', () => {
    const box = new AABB(10, 10, 40, 40);
    expect(box.containsPoint(20, 20)).toBe(true);
    expect(box.containsPoint(5, 20)).toBe(false);
    expect(box.containsPoint(55, 20)).toBe(false);
  });

  it('harus menghitung Minimum Translation Vector (MTV) tabrakan dari atas (mendarat di lantai)', () => {
    // Karakter jatuh menembus lantai sejauh 4 pixel
    const player = new AABB(50, 96, 32, 32); // y: 96..128
    const floor = new AABB(0, 124, 200, 32); // y: 124..156, overlapY = 4px

    const manifold = player.getCollisionManifold(floor);
    expect(manifold).not.toBeNull();
    // Penetrasi vertikal (4px) jauh lebih kecil dari horizontal (overlapX = 32px)
    expect(manifold?.overlapY).toBe(4);
    expect(manifold?.normalX).toBe(0);
    // Player berada di atas lantai, normal mendorong ke atas (-1)
    expect(manifold?.normalY).toBe(-1);
  });

  it('harus menghitung MTV tabrakan dari samping (membentur dinding)', () => {
    // Karakter menabrak dinding dari sisi kiri sejauh 3 pixel
    const player = new AABB(67, 50, 32, 32); // x: 67..99
    const wall = new AABB(96, 0, 32, 200);   // x: 96..128, overlapX = 3px

    const manifold = player.getCollisionManifold(wall);
    expect(manifold).not.toBeNull();
    expect(manifold?.overlapX).toBe(3);
    // Player berada di kiri dinding, normal mendorong ke kiri (-1)
    expect(manifold?.normalX).toBe(-1);
    expect(manifold?.normalY).toBe(0);
  });

  it('harus mendukung pemakaian manifold out buffer untuk zero-allocation di hot loop', () => {
    const boxA = new AABB(0, 0, 20, 20);
    const boxB = new AABB(10, 5, 20, 20);
    const scratchManifold: CollisionManifold = { overlapX: 0, overlapY: 0, normalX: 0, normalY: 0 };

    const result = boxA.getCollisionManifold(boxB, scratchManifold);
    expect(result).toBe(scratchManifold);
    expect(scratchManifold.overlapX).toBeGreaterThan(0);
  });
});
