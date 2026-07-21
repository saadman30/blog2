import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  POST_SCHEDULER_QUEUE,
  PostSchedulerPort,
} from '../../application/ports/post-scheduler.port';

@Injectable()
export class BullMqPostSchedulerAdapter implements PostSchedulerPort {
  constructor(
    @InjectQueue(POST_SCHEDULER_QUEUE)
    private readonly schedulerQueue: Queue,
  ) {}

  async schedulePublish(postId: string, at: Date): Promise<void> {
    const delay = Math.max(0, at.getTime() - Date.now());
    await this.schedulerQueue.add(
      'publish-post',
      { postId },
      { delay, jobId: `publish-${postId}`, removeOnComplete: true },
    );
  }
}
