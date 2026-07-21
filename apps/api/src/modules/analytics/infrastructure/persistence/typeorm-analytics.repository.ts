import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEntity } from '../../../../database/entities';
import { Analytics } from '../../domain/analytics.model';
import { AnalyticsRepositoryPort } from '../../application/ports/analytics.repository.port';
import { AnalyticsMapper } from './analytics.mapper';

@Injectable()
export class TypeOrmAnalyticsRepository implements AnalyticsRepositoryPort {
  constructor(
    @InjectRepository(AnalyticsEntity)
    private readonly repo: Repository<AnalyticsEntity>,
  ) {}

  async findByPostId(postId: string): Promise<Analytics | null> {
    const entity = await this.repo.findOne({ where: { postId } });
    return entity ? AnalyticsMapper.toDomain(entity) : null;
  }

  async save(data: {
    id?: string;
    postId: string;
    views: number;
    claps: number;
  }): Promise<Analytics> {
    const entity = this.repo.create(AnalyticsMapper.toPersistence(data));
    const saved = await this.repo.save(entity);
    return AnalyticsMapper.toDomain(saved);
  }

  async findAll(): Promise<Analytics[]> {
    const rows = await this.repo.find();
    return rows.map((row) => AnalyticsMapper.toDomain(row));
  }
}
