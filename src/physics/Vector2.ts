/**
 * Vector2 menyediakan kalkulasi vektor 2D dengan dukungan mutasi in-place
 * untuk menghindari alokasi memori (Garbage Collection pressure) di hot path game loop.
 */
export class Vector2 {
  constructor(public x: number = 0, public y: number = 0) {}

  /**
   * Mengatur nilai koordinat X dan Y secara in-place.
   */
  public set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Menyalin nilai dari vektor lain secara in-place.
   */
  public copy(other: Vector2): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  /**
   * Membuat duplikat instance Vector2 baru.
   */
  public clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  /**
   * Menambahkan vektor lain secara in-place.
   */
  public add(other: Vector2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  /**
   * Mengurangkan vektor lain secara in-place.
   */
  public sub(other: Vector2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  /**
   * Mengalikan skalar dengan vektor ini secara in-place.
   */
  public scale(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Menghitung dot product antara dua vektor.
   */
  public dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  /**
   * Menghitung kuadrat panjang vektor (lebih cepat dari length() karena menghindari Math.sqrt).
   */
  public lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Menghitung panjang magnitude vektor.
   */
  public length(): number {
    return Math.sqrt(this.lengthSq());
  }

  /**
   * Menormalisasi vektor menjadi unit vector (panjang = 1) secara in-place.
   */
  public normalize(): this {
    const len = this.length();
    // ⚠️ EDGE CASE: Menghindari pembagian dengan nol jika vektor adalah (0, 0).
    if (len > 0.00001) {
      this.x /= len;
      this.y /= len;
    } else {
      this.x = 0;
      this.y = 0;
    }
    return this;
  }

  /**
   * Helper statis untuk membuat vektor nol.
   */
  public static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  /**
   * Helper statis untuk operasi tambah dengan target output opsional (zero-allocation).
   */
  public static add(a: Vector2, b: Vector2, out?: Vector2): Vector2 {
    const res = out ?? new Vector2();
    res.x = a.x + b.x;
    res.y = a.y + b.y;
    return res;
  }
}
