import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { FileStoragePort } from '../../application/ports/file-storage.port';

@Injectable()
export class LocalFileStorageAdapter implements FileStoragePort {
  constructor(private readonly configService: ConfigService) {}

  private localPath(): string {
    return this.configService.get<string>('media.localPath') ?? './uploads';
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.localPath(), { recursive: true });
  }

  async write(key: string, data: Buffer): Promise<void> {
    await fs.writeFile(path.join(this.localPath(), key), data);
  }

  async unlink(key: string): Promise<void> {
    await fs.unlink(path.join(this.localPath(), key));
  }
}
