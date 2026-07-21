import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { POST_SCHEDULER_QUEUE } from '../../application/ports/post-scheduler.port';
import { PostsService } from '../../application/posts.service';

export interface PublishPostJob {
  postId: string;
}

@Processor(POST_SCHEDULER_QUEUE)
@Injectable()
export class PostSchedulerConsumer extends WorkerHost {
  private readonly logger = new Logger(PostSchedulerConsumer.name);

  constructor(private readonly postsService: PostsService) {
    super();
  }

  async process(job: Job<PublishPostJob>): Promise<{ published: boolean }> {
    const result = await this.postsService.publishScheduled(job.data.postId);
    if (result.published) {
      this.logger.log(`Published scheduled post ${job.data.postId}`);
    }
    return result;
  }
}
