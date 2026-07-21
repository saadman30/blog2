import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEntity, PostEntity } from '../../database/entities';
import { PostSchedulerConsumer } from './post-scheduler.consumer';
import { PostsController } from './posts.controller';
import { POST_SCHEDULER_QUEUE, PostsService } from './posts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, AnalyticsEntity]),
    BullModule.registerQueue({ name: POST_SCHEDULER_QUEUE }),
  ],
  controllers: [PostsController],
  providers: [PostsService, PostSchedulerConsumer],
  exports: [PostsService],
})
export class PostsModule {}
