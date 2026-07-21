import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEntity, PostEntity } from '../../database/entities';
import { AnalyticsService } from './application/analytics.service';
import { ANALYTICS_REPOSITORY } from './application/ports/analytics.repository.port';
import { PUBLISHED_POST_LOOKUP } from './application/ports/published-post.port';
import { AnalyticsController } from './infrastructure/http/analytics.controller';
import { TypeOrmAnalyticsRepository } from './infrastructure/persistence/typeorm-analytics.repository';
import { TypeOrmPublishedPostAdapter } from './infrastructure/persistence/typeorm-published-post.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEntity, PostEntity])],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    { provide: ANALYTICS_REPOSITORY, useClass: TypeOrmAnalyticsRepository },
    { provide: PUBLISHED_POST_LOOKUP, useClass: TypeOrmPublishedPostAdapter },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
