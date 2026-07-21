export const POST_ANALYTICS = Symbol('POST_ANALYTICS');

export interface PostAnalyticsPort {
  ensureForPost(postId: string): Promise<void>;
}
