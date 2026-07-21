import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaEntity } from '../../../../database/entities';
import { Media } from '../../domain/media.model';
import { MediaRepositoryPort } from '../../application/ports/media.repository.port';
import { MediaMapper } from './media.mapper';

@Injectable()
export class TypeOrmMediaRepository implements MediaRepositoryPort {
  constructor(
    @InjectRepository(MediaEntity)
    private readonly repo: Repository<MediaEntity>,
  ) {}

  async save(data: {
    url: string;
    key: string;
    mimeType: string;
    size: number;
    alt: string | null;
  }): Promise<Media> {
    const entity = this.repo.create(MediaMapper.toPersistence(data));
    const saved = await this.repo.save(entity);
    return MediaMapper.toDomain(saved);
  }

  async findAll(): Promise<Media[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map((row) => MediaMapper.toDomain(row));
  }

  async findById(id: string): Promise<Media | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? MediaMapper.toDomain(entity) : null;
  }

  async remove(media: Media): Promise<void> {
    const entity = await this.repo.findOne({ where: { id: media.id } });
    if (entity) {
      await this.repo.remove(entity);
    }
  }
}
