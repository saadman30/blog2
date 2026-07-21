export const PUBLISHED_POST_LOOKUP = Symbol('PUBLISHED_POST_LOOKUP');

export interface PublishedPostLookupPort {
  existsPublished(postId: string): Promise<boolean>;
}
