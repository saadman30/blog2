import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { MediaEntity } from '../../database/entities';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(MediaEntity)
    private readonly mediaRepository: Repository<MediaEntity>,
    private readonly configService: ConfigService,
  ) {}

  async upload(file: UploadedFileLike, alt?: string): Promise<MediaEntity> {
    const key = `${uuidv4()}.webp`;
    const localPath = this.configService.get<string>('media.localPath') ?? './uploads';
    await fs.mkdir(localPath, { recursive: true });

    const webpBuffer = await sharp(file.buffer).webp({ quality: 80 }).toBuffer();
    const filePath = path.join(localPath, key);
    await fs.writeFile(filePath, webpBuffer);

    const url = `/uploads/${key}`;
    const entity = this.mediaRepository.create({
      url,
      key,
      mimeType: 'image/webp',
      size: webpBuffer.length,
      alt: alt ?? null,
    });
    return this.mediaRepository.save(entity);
  }

  async findAll(): Promise<MediaEntity[]> {
    return this.mediaRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<MediaEntity | null> {
    return this.mediaRepository.findOne({ where: { id } });
  }

  async remove(id: string): Promise<boolean> {
    const media = await this.findById(id);
    if (!media) {
      return false;
    }
    const localPath = this.configService.get<string>('media.localPath') ?? './uploads';
    try {
      await fs.unlink(path.join(localPath, media.key));
    } catch {
      // File may already be missing; continue with DB cleanup.
    }
    await this.mediaRepository.remove(media);
    return true;
  }
}
