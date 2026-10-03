/**
 * Representasi kelas komponen dalam ECS tanpa memakai `any`.
 * Digunakan sebagai identifier unik tipe komponen di dalam World storage.
 */
export type ComponentClass<T extends object> = {
  prototype: T;
  readonly name: string;
};
