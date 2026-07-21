import { Queue } from 'bullmq';
import { BullMqPostSchedulerAdapter } from './bullmq-post-scheduler.adapter';

describe('BullMqPostSchedulerAdapter', () => {
  it('enqueues publish-post with delay and jobId', async () => {
    const schedulerQueue = { add: jest.fn() };
    const adapter = new BullMqPostSchedulerAdapter(
      schedulerQueue as unknown as Queue,
    );
    const at = new Date(Date.now() + 60_000);
    await adapter.schedulePublish('p1', at);
    expect(schedulerQueue.add).toHaveBeenCalledWith(
      'publish-post',
      { postId: 'p1' },
      expect.objectContaining({
        jobId: 'publish-p1',
        removeOnComplete: true,
      }),
    );
  });

  it('uses zero delay when scheduled in the past', async () => {
    const schedulerQueue = { add: jest.fn() };
    const adapter = new BullMqPostSchedulerAdapter(
      schedulerQueue as unknown as Queue,
    );
    await adapter.schedulePublish('p1', new Date(Date.now() - 1000));
    expect(schedulerQueue.add).toHaveBeenCalledWith(
      'publish-post',
      { postId: 'p1' },
      expect.objectContaining({ delay: 0 }),
    );
  });
});
