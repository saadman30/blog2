import { PostStatus } from '../../../../domain';
import { PostEntity } from '../../../../database/entities';
import { Post } from '../../domain/post.model';

export function toDomain(entity: PostEntity): Post {
  const post = new Post();
  post.id = entity.id;
  post.title = entity.title;
  post.slug = entity.slug;
  post.content = entity.content;
  post.summary = entity.summary;
  post.readingTime = entity.readingTime;
  post.status = entity.status as PostStatus;
  post.scheduledAt = entity.scheduledAt;
  post.publishedAt = entity.publishedAt;
  post.tags = entity.tags;
  post.category = entity.category;
  post.authorId = entity.authorId;
  post.createdAt = entity.createdAt;
  post.updatedAt = entity.updatedAt;
  if (entity.author !== undefined) {
    post.author = entity.author;
  }
  if (entity.analytics !== undefined) {
    post.analytics = entity.analytics;
  }
  return post;
}

export function toPersistence(
  data: Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'author' | 'analytics'> & {
    id?: string;
  },
): Partial<PostEntity> {
  const entity: Partial<PostEntity> = {
    title: data.title,
    slug: data.slug,
    content: data.content,
    summary: data.summary,
    readingTime: data.readingTime,
    status: data.status,
    scheduledAt: data.scheduledAt,
    publishedAt: data.publishedAt,
    tags: data.tags,
    category: data.category,
    authorId: data.authorId,
  };
  if (data.id !== undefined) {
    entity.id = data.id;
  }
  return entity;
}
