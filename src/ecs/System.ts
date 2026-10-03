import type { World } from './World';

/**
 * Interface untuk System dalam arsitektur ECS.
 * System bertanggung jawab atas semua logika dan mutasi data komponen.
 */
export interface System {
  /**
   * Dipanggil pada setiap fixed timestep update (60 FPS logic).
   * @param world Instance World tempat entitas dan komponen berada
   * @param dt Delta time konstan dalam detik
   */
  update?: (world: World, dt: number) => void;

  /**
   * Dipanggil saat browser melakukan render frame.
   * @param world Instance World tempat entitas dan komponen berada
   * @param alpha Nilai interpolasi render antara [0, 1]
   */
  render?: (world: World, alpha: number) => void;
}
