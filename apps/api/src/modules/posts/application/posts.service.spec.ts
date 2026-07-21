import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostStatus } from '../../../domain';
import { Post } from '../domain/post.model';
import { HtmlRendererPort } from './ports/html-renderer.port';
import { PostAnalyticsPort } from './ports/post-analytics.port';
import { PostRepositoryPort } from './ports/post.repository.port';
import { PostSchedulerPort } from './ports/post-scheduler.port';
import { PostsService } from './posts.service';

jest.mock('../../../common/utils/content.util', () => ({
  estimateReadingTime: jest.fn(() => 2),
  slugify: jest.fn((input: string) =>
    input
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, ''),
  ),
}));

describe('PostsService', () => {
  let service: PostsService;
  let posts: jest.Mocked<PostRepositoryPort>;
  let analytics: jest.Mocked<PostAnalyticsPort>;
  let scheduler: jest.Mocked<PostSchedulerPort>;
  let htmlRenderer: jest.Mocked<HtmlRendererPort>;

  const author = { id: 'a1' };

  const basePost: Post = {
    id: 'p1',
    title: 'Hello',
    slug: 'hello',
    content: 'body',
    summary: null,
    readingTime: 2,
    status: PostStatus.DRAFT,
    scheduledAt: null,
    publishedAt: null,
    tags: [],
    category: null,
    authorId: 'a1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    posts = {
      save: jest.fn(async (v) => ({ ...basePost, ...v, id: v.id ?? 'p1' })),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findAllAdmin: jest.fn(),
      findPublished: jest.fn(),
      findBySlugExact: jest.fn(),
      remove: jest.fn(),
    };
    analytics = {
      ensureForPost: jest.fn(),
    };
    scheduler = {
      schedulePublish: jest.fn(),
    };
    htmlRenderer = {
      render: jest.fn(async (c) => `<p>${c}</p>`),
    };
    service = new PostsService(posts, analytics, scheduler, htmlRenderer);
  });

  it('creates draft posts', async () => {
    posts.findBySlugExact.mockResolvedValue(null);
    const post = await service.create(author, {
      title: 'Hello',
      content: 'body',
    });
    expect(post.slug).toBe('hello');
    expect(analytics.ensureForPost).toHaveBeenCalledWith('p1');
  });

  it('creates published posts with publishedAt', async () => {
    posts.findBySlugExact.mockResolvedValue(null);
    const post = await service.create(author, {
      title: 'Hello',
      content: 'body',
      status: PostStatus.PUBLISHED,
      tags: ['ts'],
      category: 'eng',
      summary: 'sum',
      slug: 'custom',
    });
    expect(post.status).toBe(PostStatus.PUBLISHED);
    expect(post.publishedAt).toBeInstanceOf(Date);
  });

  it('schedules posts and enqueues job', async () => {
    posts.findBySlugExact.mockResolvedValue(null);
    const when = new Date(Date.now() + 60_000).toISOString();
    await service.create(author, {
      title: 'Later',
      content: 'body',
      status: PostStatus.SCHEDULED,
      scheduledAt: when,
    });
    expect(scheduler.schedulePublish).toHaveBeenCalled();
  });

  it('rejects scheduled without date', async () => {
    await expect(
      service.create(author, {
        title: 'Later',
        content: 'body',
        status: PostStatus.SCHEDULED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ensures unique slugs', async () => {
    posts.findBySlugExact
      .mockResolvedValueOnce({ ...basePost, id: 'other', slug: 'hello' })
      .mockResolvedValueOnce(null);
    const post = await service.create(author, {
      title: 'Hello',
      content: 'body',
    });
    expect(post.slug).toBe('hello-1');
  });

  it('lists admin and published posts', async () => {
    posts.findAllAdmin.mockResolvedValue([basePost]);
    await expect(service.findAllAdmin()).resolves.toHaveLength(1);

    posts.findPublished.mockResolvedValue([basePost]);
    await expect(service.findPublished()).resolves.toHaveLength(1);
    await expect(service.findPublished('ts')).resolves.toHaveLength(1);
    expect(posts.findPublished).toHaveBeenCalledWith('ts');
  });

  it('findBySlug and findById', async () => {
    posts.findBySlug.mockResolvedValue(basePost);
    posts.findById.mockResolvedValue(basePost);
    await expect(service.findBySlug('hello')).resolves.toEqual(basePost);
    await expect(service.findBySlug('hello', false)).resolves.toEqual(basePost);
    await expect(service.findById('p1')).resolves.toEqual(basePost);
  });

  it('throws when post missing', async () => {
    posts.findBySlug.mockResolvedValue(null);
    posts.findById.mockResolvedValue(null);
    await expect(service.findBySlug('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findById('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates fields without changing status', async () => {
    posts.findById.mockResolvedValue({ ...basePost });
    const updated = await service.update('p1', { title: 'Only title' });
    expect(updated.title).toBe('Only title');
    expect(updated.status).toBe(PostStatus.DRAFT);
  });

  it('clears scheduledAt when explicitly null', async () => {
    posts.findById.mockResolvedValue({
      ...basePost,
      scheduledAt: new Date(),
    });
    const updated = await service.update('p1', { scheduledAt: null });
    expect(updated.scheduledAt).toBeNull();
  });

  it('updates posts and republishes', async () => {
    posts.findById.mockResolvedValue({ ...basePost });
    posts.findBySlugExact.mockResolvedValue(null);
    const updated = await service.update('p1', {
      title: 'New',
      content: 'new body',
      summary: 's',
      tags: ['a'],
      category: 'c',
      slug: 'new-slug',
      status: PostStatus.PUBLISHED,
      scheduledAt: null,
    });
    expect(updated.title).toBe('New');
  });

  it('updates scheduled post and enqueues', async () => {
    const when = new Date(Date.now() + 120_000);
    posts.findById.mockResolvedValue({ ...basePost });
    await service.update('p1', {
      status: PostStatus.SCHEDULED,
      scheduledAt: when.toISOString(),
    });
    expect(scheduler.schedulePublish).toHaveBeenCalled();
  });

  it('validates schedule on status change using existing date', async () => {
    posts.findById.mockResolvedValue({
      ...basePost,
      scheduledAt: null,
    });
    await expect(
      service.update('p1', { status: PostStatus.SCHEDULED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps existing publishedAt when republishing', async () => {
    const publishedAt = new Date('2020-01-01');
    posts.findById.mockResolvedValue({
      ...basePost,
      status: PostStatus.ARCHIVED,
      publishedAt,
    });
    const updated = await service.update('p1', {
      status: PostStatus.PUBLISHED,
    });
    expect(updated.publishedAt).toEqual(publishedAt);
  });

  it('removes posts', async () => {
    posts.findById.mockResolvedValue({ ...basePost });
    await service.remove('p1');
    expect(posts.remove).toHaveBeenCalled();
  });

  it('renders html via renderer port', async () => {
    await expect(service.renderHtml('hi')).resolves.toBe('<p>hi</p>');
    expect(htmlRenderer.render).toHaveBeenCalledWith('hi');
  });

  it('falls back to post slug when slugify is empty', async () => {
    const contentUtil = await import('../../../common/utils/content.util');
    (contentUtil.slugify as jest.Mock).mockReturnValueOnce('');
    posts.findBySlugExact.mockResolvedValue(null);
    const post = await service.create(author, {
      title: '???',
      content: 'body',
    });
    expect(post.slug).toBe('post');
  });

  it('validates schedule using existing scheduledAt when only status changes', async () => {
    const when = new Date(Date.now() + 60_000);
    posts.findById.mockResolvedValue({
      ...basePost,
      scheduledAt: when,
    });
    await service.update('p1', { status: PostStatus.SCHEDULED });
    expect(scheduler.schedulePublish).toHaveBeenCalled();
  });

  it('publishes a due scheduled post', async () => {
    posts.findById.mockResolvedValue({
      ...basePost,
      status: PostStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() - 1000),
    });
    await expect(service.publishScheduled('p1')).resolves.toEqual({
      published: true,
    });
    expect(posts.save).toHaveBeenCalled();
  });

  it('skips missing or non-scheduled posts when publishing', async () => {
    posts.findById.mockResolvedValue(null);
    await expect(service.publishScheduled('x')).resolves.toEqual({
      published: false,
    });

    posts.findById.mockResolvedValue({
      ...basePost,
      status: PostStatus.DRAFT,
    });
    await expect(service.publishScheduled('p1')).resolves.toEqual({
      published: false,
    });
  });

  it('skips posts not yet due when publishing', async () => {
    posts.findById.mockResolvedValue({
      ...basePost,
      status: PostStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() + 60_000),
    });
    await expect(service.publishScheduled('p1')).resolves.toEqual({
      published: false,
    });
  });

  it('publishes scheduled posts with null scheduledAt', async () => {
    posts.findById.mockResolvedValue({
      ...basePost,
      status: PostStatus.SCHEDULED,
      scheduledAt: null,
    });
    await expect(service.publishScheduled('p1')).resolves.toEqual({
      published: true,
    });
  });
});
