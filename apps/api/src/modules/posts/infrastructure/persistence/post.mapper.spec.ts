import { PostStatus } from '../../../../domain';
import { PostEntity } from '../../../../database/entities';
import { Post } from '../../domain/post.model';
import { toDomain, toPersistence } from './post.mapper';

describe('post.mapper', () => {
  const entity = {
    id: 'p1',
    title: 'Hello',
    slug: 'hello',
    content: 'body',
    summary: 'sum',
    readingTime: 2,
    status: PostStatus.DRAFT,
    scheduledAt: null,
    publishedAt: null,
    tags: ['a'],
    category: 'eng',
    authorId: 'a1',
    author: { id: 'a1' },
    analytics: { id: 'an1', postId: 'p1', views: 0, claps: 0 },
    createdAt: new Date('2020-01-01'),
    updatedAt: new Date('2020-01-02'),
  } as unknown as PostEntity;

  it('maps entity to domain including relations', () => {
    const post = toDomain(entity);
    expect(post).toMatchObject({
      id: 'p1',
      title: 'Hello',
      slug: 'hello',
      authorId: 'a1',
      tags: ['a'],
    });
    expect(post.author).toEqual({ id: 'a1' });
    expect(post.analytics).toEqual({
      id: 'an1',
      postId: 'p1',
      views: 0,
      claps: 0,
    });
  });

  it('omits undefined relations', () => {
    const bare = {
      ...entity,
      author: undefined,
      analytics: undefined,
    } as unknown as PostEntity;
    const post = toDomain(bare);
    expect(post.author).toBeUndefined();
    expect(post.analytics).toBeUndefined();
  });

  it('maps domain to persistence with and without id', () => {
    const post: Post = {
      id: 'p1',
      title: 'Hello',
      slug: 'hello',
      content: 'body',
      summary: null,
      readingTime: 2,
      status: PostStatus.PUBLISHED,
      scheduledAt: null,
      publishedAt: new Date(),
      tags: [],
      category: null,
      authorId: 'a1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(toPersistence(post).id).toBe('p1');
    expect(
      toPersistence({
        title: post.title,
        slug: post.slug,
        content: post.content,
        summary: post.summary,
        readingTime: post.readingTime,
        status: post.status,
        scheduledAt: post.scheduledAt,
        publishedAt: post.publishedAt,
        tags: post.tags,
        category: post.category,
        authorId: post.authorId,
      }).id,
    ).toBeUndefined();
  });
});
