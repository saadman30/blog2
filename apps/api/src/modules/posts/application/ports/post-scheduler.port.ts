export const POST_SCHEDULER = Symbol('POST_SCHEDULER');
export const POST_SCHEDULER_QUEUE = 'post-scheduler';

export interface PostSchedulerPort {
  schedulePublish(postId: string, at: Date): Promise<void>;
}
