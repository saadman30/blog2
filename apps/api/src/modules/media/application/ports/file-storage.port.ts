export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStoragePort {
  ensureDir(): Promise<void>;
  write(key: string, data: Buffer): Promise<void>;
  unlink(key: string): Promise<void>;
}
