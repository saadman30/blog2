import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEntity } from '../../../../database/entities';
import { PostAnalyticsPort } from '../../application/ports/post-analytics.port';

@Injectable()
export class TypeOrmPostAnalyticsAdapter implements PostAnalyticsPort {
  constructor(
    @InjectRepository(AnalyticsEntity)
    private readonly analyticsRepository: Repository<AnalyticsEntity>,
  ) {}

  async ensureForPost(postId: string): Promise<void> {
    await this.analyticsRepository.save(
      this.analyticsRepository.create({ postId, views: 0, claps: 0 }),
    );
  }
}
