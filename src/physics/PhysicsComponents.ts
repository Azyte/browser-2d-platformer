import { AABB } from './AABB';

/**
 * RigidBodyComponent menyimpan data simulasi fisika: gravitasi, massa, dan status kontak.
 */
export class RigidBodyComponent {
  public mass: number;
  public useGravity: boolean;
  public gravityScale: number;
  public terminalVelocity: number;
  public isGrounded: boolean = false;
  public isCollidingHorizontally: boolean = false;

  constructor(options?: {
    mass?: number;
    useGravity?: boolean;
    gravityScale?: number;
    terminalVelocity?: number;
  }) {
    this.mass = options?.mass ?? 1;
    this.useGravity = options?.useGravity ?? true;
    this.gravityScale = options?.gravityScale ?? 1.0;
    this.terminalVelocity = options?.terminalVelocity ?? 900;
  }
}

/**
 * ColliderComponent menentukan kotak batas tabrakan (hitbox AABB) untuk suatu entitas.
 */
export class ColliderComponent {
  public width: number;
  public height: number;
  public offsetX: number;
  public offsetY: number;
  public isSolid: boolean;

  private readonly bounds: AABB = new AABB();

  constructor(
    width: number,
    height: number,
    offsetX: number = 0,
    offsetY: number = 0,
    isSolid: boolean = true
  ) {
    this.width = width;
    this.height = height;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.isSolid = isSolid;
  }

  /**
   * Mengambil AABB dunia dari collider berdasarkan koordinat transform entitas.
   * Menggunakan instance AABB internal (in-place) untuk zero-allocation di hot loop.
   */
  public getBounds(transformX: number, transformY: number): AABB {
    this.bounds.x = transformX + this.offsetX;
    this.bounds.y = transformY + this.offsetY;
    this.bounds.width = this.width;
    this.bounds.height = this.height;
    return this.bounds;
  }
}

/**
 * SolidObstacleComponent menandai entitas sebagai rintangan lingkungan statis (lantai, dinding, platform).
 */
export class SolidObstacleComponent {}
