import type { Entity } from './Entity';
import type { ComponentClass } from './Component';
import type { System } from './System';

/**
 * World adalah pengelola sentral untuk seluruh Entitas, Komponen, dan Sistem di ECS.
 * Menggunakan arsitektur Map-based Component Store yang type-safe dan deterministik.
 */
export class World {
  private nextEntityId: Entity = 1;
  private readonly entities: Set<Entity> = new Set();
  private readonly componentStores: Map<ComponentClass<object>, Map<Entity, object>> = new Map();
  private readonly systems: System[] = [];
  private readonly pendingDestruction: Set<Entity> = new Set();

  /**
   * Membuat entitas baru dengan ID unik dan mendaftarkannya ke World.
   * @returns Entity ID yang baru dibuat
   */
  public createEntity(): Entity {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }

  /**
   * Memeriksa apakah suatu entitas masih hidup (terdaftar dan belum dihapus).
   * @param entity ID entitas yang ingin diperiksa
   */
  public isAlive(entity: Entity): boolean {
    return this.entities.has(entity) && !this.pendingDestruction.has(entity);
  }

  /**
   * Menghapus entitas dan seluruh komponen miliknya dari World secara langsung.
   * @param entity ID entitas yang akan dimusnahkan
   */
  public destroyEntity(entity: Entity): void {
    if (!this.entities.has(entity)) return;

    // Bersihkan semua komponen dari setiap component store
    for (const store of this.componentStores.values()) {
      store.delete(entity);
    }

    this.entities.delete(entity);
    this.pendingDestruction.delete(entity);
  }

  /**
   * Menandai entitas untuk dihapus pada akhir tick update.
   * Mencegah modifikasi struktur koleksi saat sistem sedang melakukan iterasi (query).
   * @param entity ID entitas yang akan dijadwalkan untuk dihapus
   */
  public queueDestroy(entity: Entity): void {
    // ⚠️ EDGE CASE: Menghancurkan entitas di tengah loop query suatu sistem
    // (misalnya peluru menabrak musuh) dapat merusak urutan iterasi array.
    // Gunakan queueDestroy agar pembersihan ditunda sampai akhir tick.
    if (this.entities.has(entity)) {
      this.pendingDestruction.add(entity);
    }
  }

  /**
   * Menambahkan instance komponen ke dalam entitas.
   * @param entity ID entitas tujuan
   * @param component Instance komponen
   * @returns Instance komponen yang ditambahkan
   */
  public addComponent<T extends object>(entity: Entity, component: T): T {
    if (!this.entities.has(entity)) {
      throw new Error(`Gagal menambahkan komponen: Entitas ${entity} tidak ditemukan`);
    }

    const componentClass = component.constructor as ComponentClass<T>;
    let store = this.componentStores.get(componentClass as ComponentClass<object>);
    if (!store) {
      store = new Map<Entity, object>();
      this.componentStores.set(componentClass as ComponentClass<object>, store);
    }

    store.set(entity, component);
    return component;
  }

  /**
   * Mengambil instance komponen dari suatu entitas.
   * @param entity ID entitas
   * @param componentClass Kelas komponen yang dicari
   * @returns Instance komponen jika ada, atau undefined
   */
  public getComponent<T extends object>(entity: Entity, componentClass: ComponentClass<T>): T | undefined {
    const store = this.componentStores.get(componentClass as ComponentClass<object>);
    if (!store) return undefined;
    return store.get(entity) as T | undefined;
  }

  /**
   * Memeriksa apakah suatu entitas memiliki komponen tertentu.
   * @param entity ID entitas
   * @param componentClass Kelas komponen yang diperiksa
   */
  public hasComponent<T extends object>(entity: Entity, componentClass: ComponentClass<T>): boolean {
    const store = this.componentStores.get(componentClass as ComponentClass<object>);
    if (!store) return false;
    return store.has(entity);
  }

  /**
   * Menghapus komponen tertentu dari entitas.
   * @param entity ID entitas
   * @param componentClass Kelas komponen yang ingin dicabut
   */
  public removeComponent<T extends object>(entity: Entity, componentClass: ComponentClass<T>): void {
    const store = this.componentStores.get(componentClass as ComponentClass<object>);
    if (store) {
      store.delete(entity);
    }
  }

  /**
   * Mengambil daftar entitas yang memiliki SEMUA komponen yang disyaratkan.
   * Menggunakan optimasi filter urutan store terkecil untuk efisiensi CPU.
   * @param componentClasses Daftar kelas komponen yang wajib dimiliki
   * @returns Array Entity ID yang cocok
   */
  public query(...componentClasses: ComponentClass<object>[]): Entity[] {
    if (componentClasses.length === 0) {
      return Array.from(this.entities);
    }

    // Ambil semua store terkait. Jika ada komponen yang belum pernah didaftarkan entitas apapun,
    // langsung kembalikan array kosong (early return).
    const stores: Map<Entity, object>[] = [];
    for (const compClass of componentClasses) {
      const store = this.componentStores.get(compClass);
      if (!store || store.size === 0) {
        return [];
      }
      stores.push(store);
    }

    // Optimasi: Urutkan store dari yang berukuran paling kecil ke yang paling besar.
    // Iterasi dimulai dari kumpulan entitas yang paling sedikit sehingga jumlah pengecekan minimal.
    stores.sort((a, b) => a.size - b.size);

    const smallestStore = stores[0];
    const otherStores = stores.slice(1);
    const result: Entity[] = [];

    for (const entity of smallestStore.keys()) {
      if (!this.isAlive(entity)) continue;

      let hasAll = true;
      for (const store of otherStores) {
        if (!store.has(entity)) {
          hasAll = false;
          break;
        }
      }

      if (hasAll) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * Mendaftarkan System baru ke dalam World.
   * @param system Instance sistem yang mengimplementasikan interface System
   */
  public addSystem(system: System): void {
    this.systems.push(system);
  }

  /**
   * Menjalankan fase update logic untuk seluruh sistem yang terdaftar.
   * @param dt Fixed delta time dalam detik
   */
  public update(dt: number): void {
    for (const system of this.systems) {
      system.update?.(this, dt);
    }

    // Eksekusi antrean pemusnahan entitas setelah seluruh sistem selesai update
    this.flushDestroyQueue();
  }

  /**
   * Menjalankan fase render untuk seluruh sistem yang terdaftar.
   * @param alpha Nilai interpolasi render [0, 1]
   */
  public render(alpha: number): void {
    for (const system of this.systems) {
      system.render?.(this, alpha);
    }
  }

  /**
   * Membersihkan entitas yang masuk antrean penghapusan.
   */
  public flushDestroyQueue(): void {
    if (this.pendingDestruction.size === 0) return;

    for (const entity of this.pendingDestruction) {
      this.destroyEntity(entity);
    }
    this.pendingDestruction.clear();
  }

  /**
   * Menghitung total entitas aktif saat ini.
   */
  public get entityCount(): number {
    return this.entities.size;
  }
}
