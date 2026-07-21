import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { PostEntity, PostStatus } from '../../database/entities';
import { POST_SCHEDULER_QUEUE } from './posts.service';

export interface PublishPostJob {
  postId: string;
}

@Processor(POST_SCHEDULER_QUEUE)
@Injectable()
export class PostSchedulerConsumer extends WorkerHost {
  private readonly logger = new Logger(PostSchedulerConsumer.name);

  constructor(
    @InjectRepository(PostEntity)
    private readonly postsRepository: Repository<PostEntity>,
  ) {
    super();
  }

  async process(job: Job<PublishPostJob>): Promise<{ published: boolean }> {
    return this.publishOne(job.data.postId);
  }

  private async publishOne(postId: string): Promise<{ published: boolean }> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.status !== PostStatus.SCHEDULED) {
      return { published: false };
    }
    if (post.scheduledAt && post.scheduledAt.getTime() > Date.now()) {
      return { published: false };
    }
    post.status = PostStatus.PUBLISHED;
    post.publishedAt = new Date();
    await this.postsRepository.save(post);
    this.logger.log(`Published scheduled post ${postId}`);
    return { published: true };
  }
}
