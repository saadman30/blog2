import { Job } from 'bullmq';
import { PostsService } from '../../application/posts.service';
import {
  PostSchedulerConsumer,
  PublishPostJob,
} from './post-scheduler.consumer';

describe('PostSchedulerConsumer', () => {
  let consumer: PostSchedulerConsumer;
  let postsService: { publishScheduled: jest.Mock };

  beforeEach(() => {
    postsService = {
      publishScheduled: jest.fn(),
    };
    consumer = new PostSchedulerConsumer(
      postsService as unknown as PostsService,
    );
  });

  it('publishes via posts service and logs success', async () => {
    postsService.publishScheduled.mockResolvedValue({ published: true });
    const logSpy = jest.spyOn(
      (consumer as unknown as { logger: { log: (m: string) => void } }).logger,
      'log',
    );
    const result = await consumer.process({
      name: 'publish-post',
      data: { postId: 'p1' },
    } as Job<PublishPostJob>);
    expect(result).toEqual({ published: true });
    expect(postsService.publishScheduled).toHaveBeenCalledWith('p1');
    expect(logSpy).toHaveBeenCalled();
  });

  it('skips logging when not published', async () => {
    postsService.publishScheduled.mockResolvedValue({ published: false });
    const logSpy = jest.spyOn(
      (consumer as unknown as { logger: { log: (m: string) => void } }).logger,
      'log',
    );
    await expect(
      consumer.process({
        name: 'publish-post',
        data: { postId: 'x' },
      } as Job<PublishPostJob>),
    ).resolves.toEqual({ published: false });
    expect(logSpy).not.toHaveBeenCalled();
  });
});
