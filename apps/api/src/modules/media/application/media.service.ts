import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Media } from '../domain/media.model';
import {
  FILE_STORAGE,
  FileStoragePort,
} from './ports/file-storage.port';
import {
  IMAGE_PROCESSOR,
  ImageProcessorPort,
} from './ports/image-processor.port';
import {
  MEDIA_REPOSITORY,
  MediaRepositoryPort,
} from './ports/media.repository.port';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: MediaRepositoryPort,
    @Inject(IMAGE_PROCESSOR)
    private readonly imageProcessor: ImageProcessorPort,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStoragePort,
  ) {}

  async upload(file: UploadedFileLike, alt?: string): Promise<Media> {
    const key = `${uuidv4()}.webp`;
    await this.fileStorage.ensureDir();

    const webpBuffer = await this.imageProcessor.toWebp(file.buffer);
    await this.fileStorage.write(key, webpBuffer);

    const url = `/uploads/${key}`;
    return this.mediaRepository.save({
      url,
      key,
      mimeType: 'image/webp',
      size: webpBuffer.length,
      alt: alt ?? null,
    });
  }

  async findAll(): Promise<Media[]> {
    return this.mediaRepository.findAll();
  }

  async findById(id: string): Promise<Media | null> {
    return this.mediaRepository.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const media = await this.findById(id);
    if (!media) {
      return false;
    }
    try {
      await this.fileStorage.unlink(media.key);
    } catch {
      // File may already be missing; continue with DB cleanup.
    }
    await this.mediaRepository.remove(media);
    return true;
  }
}
