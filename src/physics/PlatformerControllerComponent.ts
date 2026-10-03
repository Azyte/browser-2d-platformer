export interface PlatformerControllerOptions {
  moveSpeed?: number;
  acceleration?: number;
  deceleration?: number;
  airAcceleration?: number;
  airDeceleration?: number;
  jumpForce?: number;
  jumpCutMultiplier?: number;
  coyoteDuration?: number;
  jumpBufferDuration?: number;
}

/**
 * PlatformerControllerComponent menyimpan konfigurasi dan state timer untuk platformer game feel:
 * Coyote Time, Jump Buffering, Variable Jump Height, dan Kinematic Acceleration.
 */
export class PlatformerControllerComponent {
  public moveSpeed: number;
  public acceleration: number;
  public deceleration: number;
  public airAcceleration: number;
  public airDeceleration: number;

  public jumpForce: number;
  public jumpCutMultiplier: number;

  public coyoteDuration: number;
  public coyoteTimer: number = 0;

  public jumpBufferDuration: number;
  public jumpBufferTimer: number = 0;

  public isJumping: boolean = false;

  constructor(options?: PlatformerControllerOptions) {
    this.moveSpeed = options?.moveSpeed ?? 240;
    this.acceleration = options?.acceleration ?? 1800;
    this.deceleration = options?.deceleration ?? 2200;
    this.airAcceleration = options?.airAcceleration ?? 1200;
    this.airDeceleration = options?.airDeceleration ?? 600;

    this.jumpForce = options?.jumpForce ?? 500;
    this.jumpCutMultiplier = options?.jumpCutMultiplier ?? 0.5;

    this.coyoteDuration = options?.coyoteDuration ?? 0.12; // 120ms
    this.jumpBufferDuration = options?.jumpBufferDuration ?? 0.12; // 120ms
  }
}
