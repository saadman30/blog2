import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEntity, PostEntity } from '../../database/entities';
import { HTML_RENDERER } from './application/ports/html-renderer.port';
import { POST_ANALYTICS } from './application/ports/post-analytics.port';
import { POST_REPOSITORY } from './application/ports/post.repository.port';
import {
  POST_SCHEDULER,
  POST_SCHEDULER_QUEUE,
} from './application/ports/post-scheduler.port';
import { PostsService } from './application/posts.service';
import { BullMqPostSchedulerAdapter } from './infrastructure/messaging/bullmq-post-scheduler.adapter';
import { PostSchedulerConsumer } from './infrastructure/messaging/post-scheduler.consumer';
import { TypeOrmPostAnalyticsAdapter } from './infrastructure/persistence/typeorm-post-analytics.adapter';
import { TypeOrmPostRepository } from './infrastructure/persistence/typeorm-post.repository';
import { MarkedHtmlRendererAdapter } from './infrastructure/rendering/marked-html-renderer.adapter';
import { PostsController } from './infrastructure/http/posts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, AnalyticsEntity]),
    BullModule.registerQueue({ name: POST_SCHEDULER_QUEUE }),
  ],
  controllers: [PostsController],
  providers: [
    PostsService,
    PostSchedulerConsumer,
    { provide: POST_REPOSITORY, useClass: TypeOrmPostRepository },
    { provide: POST_ANALYTICS, useClass: TypeOrmPostAnalyticsAdapter },
    { provide: POST_SCHEDULER, useClass: BullMqPostSchedulerAdapter },
    { provide: HTML_RENDERER, useClass: MarkedHtmlRendererAdapter },
  ],
  exports: [PostsService],
})
export class PostsModule {}
