
export interface CollisionManifold {
  /** Kedalaman penetrasi overlap pada sumbu X. */
  overlapX: number;
  /** Kedalaman penetrasi overlap pada sumbu Y. */
  overlapY: number;
  /**
   * Vektor normal tabrakan X yang menunjukkan arah untuk mendorong box A keluar dari box B.
   * -1 jika A di sebelah kiri B, 1 jika A di sebelah kanan B.
   */
  normalX: number;
  /**
   * Vektor normal tabrakan Y yang menunjukkan arah untuk mendorong box A keluar dari box B.
   * -1 jika A di atas B (mendarat di lantai B), 1 jika A di bawah B (membentur langit-langit B).
   */
  normalY: number;
}

/**
 * Axis-Aligned Bounding Box (AABB) merepresentasikan kotak pembatas tanpa rotasi
 * untuk kalkulasi deteksi tabrakan 2D yang efisien.
 */
export class AABB {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public width: number = 0,
    public height: number = 0
  ) {}

  public get minX(): number {
    return this.x;
  }

  public get minY(): number {
    return this.y;
  }

  public get maxX(): number {
    return this.x + this.width;
  }

  public get maxY(): number {
    return this.y + this.height;
  }

  /**
   * Mengatur ulang posisi dan dimensi AABB secara in-place.
   */
  public set(x: number, y: number, width: number, height: number): this {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    return this;
  }

  /**
   * Memeriksa apakah AABB ini bertabrakan / beririsan dengan AABB lain.
   */
  public intersects(other: AABB): boolean {
    return (
      this.minX < other.maxX &&
      this.maxX > other.minX &&
      this.minY < other.maxY &&
      this.maxY > other.minY
    );
  }

  /**
   * Memeriksa apakah suatu koordinat titik (px, py) berada di dalam AABB.
   */
  public containsPoint(px: number, py: number): boolean {
    return px >= this.minX && px <= this.maxX && py >= this.minY && py <= this.maxY;
  }

  /**
   * Menghitung Collision Manifold (kedalaman penetrasi dan normal tabrakan)
   * menggunakan algoritma Minimum Translation Vector (MTV).
   * @param other Bounding box rintangan / target
   * @param out Objek CollisionManifold opsional untuk menghindari alokasi memori di hot path
   * @returns CollisionManifold jika terjadi irisan, atau null jika tidak bertabrakan
   */
  public getCollisionManifold(other: AABB, out?: CollisionManifold): CollisionManifold | null {
    if (!this.intersects(other)) {
      return null;
    }

    const centerAX = this.x + this.width / 2;
    const centerAY = this.y + this.height / 2;
    const centerBX = other.x + other.width / 2;
    const centerBY = other.y + other.height / 2;

    const diffX = centerAX - centerBX;
    const diffY = centerAY - centerBY;

    const halfW = (this.width + other.width) / 2;
    const halfH = (this.height + other.height) / 2;

    const overlapX = halfW - Math.abs(diffX);
    const overlapY = halfH - Math.abs(diffY);

    const manifold: CollisionManifold = out ?? {
      overlapX: 0,
      overlapY: 0,
      normalX: 0,
      normalY: 0,
    };

    manifold.overlapX = overlapX;
    manifold.overlapY = overlapY;

    // Minimum Translation Vector (MTV):
    // Dorong objek ke sumbu yang memiliki penetrasi terkecil.
    // ⚠️ EDGE CASE: Tabrakan tepat di sudut diagonal (overlapX === overlapY).
    // Dalam game platformer 2D, prioritaskan penyelesaian sumbu vertikal (Y)
    // agar karakter tidak tersangkut di sambungan horizontal antar-ubin (tile seams).
    if (overlapX < overlapY) {
      manifold.normalX = diffX > 0 ? 1 : -1;
      manifold.normalY = 0;
    } else {
      manifold.normalX = 0;
      manifold.normalY = diffY > 0 ? 1 : -1;
    }

    return manifold;
  }
}
