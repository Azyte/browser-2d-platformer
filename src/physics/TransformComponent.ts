/**
 * TransformComponent menyimpan posisi spasial entitas di koordinat dunia game.
 * Menyimpan prevX dan prevY untuk kebutuhan render interpolation alpha.
 */
export class TransformComponent {
  public prevX: number;
  public prevY: number;

  constructor(public x: number = 0, public y: number = 0) {
    this.prevX = x;
    this.prevY = y;
  }
}
