export const CACHE_HEALTH = Symbol('CACHE_HEALTH');

export interface CacheHealthPort {
  check(): Promise<{ ok: boolean; message?: string }>;
}
