import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  AnalyticsEntity,
  PostEntity,
  PostStatus,
  UserEntity,
  UserRole,
} from '../../database/entities';
import { PostsService } from './posts.service';

jest.mock('marked', () => ({
  marked: {
    parse: jest.fn(async (content: string) => `<p>${content}</p>`),
  },
}));

jest.mock('../../common/utils/content.util', () => ({
  estimateReadingTime: jest.fn(() => 2),
  sanitizeHtml: jest.fn((html: string) => html),
  slugify: jest.fn((input: string) =>
    input
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, ''),
  ),
}));

describe('PostsService', () => {
  let service: PostsService;
  let postsRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let analyticsRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let schedulerQueue: { add: jest.Mock };

  const author = {
    id: 'a1',
    email: 'a@b.com',
    role: UserRole.EDITOR,
  } as UserEntity;

  const basePost: PostEntity = {
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
    author,
    comments: [],
    analytics: {} as AnalyticsEntity,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    postsRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...basePost, ...v, id: v.id ?? 'p1' })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    analyticsRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
    };
    schedulerQueue = { add: jest.fn() };
    service = new PostsService(
      postsRepository as unknown as Repository<PostEntity>,
      analyticsRepository as unknown as Repository<AnalyticsEntity>,
      schedulerQueue as unknown as Queue,
    );
  });

  it('creates draft posts', async () => {
    postsRepository.findOne.mockResolvedValue(null);
    const post = await service.create(author, {
      title: 'Hello',
      content: 'body',
    });
    expect(post.slug).toBe('hello');
    expect(analyticsRepository.save).toHaveBeenCalled();
  });

  it('creates published posts with publishedAt', async () => {
    postsRepository.findOne.mockResolvedValue(null);
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
    postsRepository.findOne.mockResolvedValue(null);
    const when = new Date(Date.now() + 60_000).toISOString();
    await service.create(author, {
      title: 'Later',
      content: 'body',
      status: PostStatus.SCHEDULED,
      scheduledAt: when,
    });
    expect(schedulerQueue.add).toHaveBeenCalled();
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
    postsRepository.findOne
      .mockResolvedValueOnce({ ...basePost, id: 'other', slug: 'hello' })
      .mockResolvedValueOnce(null);
    const post = await service.create(author, {
      title: 'Hello',
      content: 'body',
    });
    expect(post.slug).toBe('hello-1');
  });

  it('lists admin and published posts', async () => {
    postsRepository.find.mockResolvedValue([basePost]);
    await expect(service.findAllAdmin()).resolves.toHaveLength(1);

    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([basePost]),
    };
    postsRepository.createQueryBuilder.mockReturnValue(
      qb as unknown as SelectQueryBuilder<PostEntity>,
    );
    await expect(service.findPublished()).resolves.toHaveLength(1);
    await expect(service.findPublished('ts')).resolves.toHaveLength(1);
    expect(qb.andWhere).toHaveBeenCalled();
  });

  it('findBySlug and findById', async () => {
    postsRepository.findOne.mockResolvedValue(basePost);
    await expect(service.findBySlug('hello')).resolves.toEqual(basePost);
    await expect(service.findBySlug('hello', false)).resolves.toEqual(basePost);
    await expect(service.findById('p1')).resolves.toEqual(basePost);
  });

  it('throws when post missing', async () => {
    postsRepository.findOne.mockResolvedValue(null);
    await expect(service.findBySlug('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findById('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates fields without changing status', async () => {
    postsRepository.findOne.mockResolvedValue({ ...basePost });
    const updated = await service.update('p1', { title: 'Only title' });
    expect(updated.title).toBe('Only title');
    expect(updated.status).toBe(PostStatus.DRAFT);
  });

  it('clears scheduledAt when explicitly null', async () => {
    postsRepository.findOne.mockResolvedValue({
      ...basePost,
      scheduledAt: new Date(),
    });
    const updated = await service.update('p1', { scheduledAt: null });
    expect(updated.scheduledAt).toBeNull();
  });

  it('updates posts and republishes', async () => {
    postsRepository.findOne
      .mockResolvedValueOnce({ ...basePost })
      .mockResolvedValueOnce(null);
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
    postsRepository.findOne.mockResolvedValue({ ...basePost });
    await service.update('p1', {
      status: PostStatus.SCHEDULED,
      scheduledAt: when.toISOString(),
    });
    expect(schedulerQueue.add).toHaveBeenCalled();
  });

  it('validates schedule on status change using existing date', async () => {
    postsRepository.findOne.mockResolvedValue({
      ...basePost,
      scheduledAt: null,
    });
    await expect(
      service.update('p1', { status: PostStatus.SCHEDULED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps existing publishedAt when republishing', async () => {
    const publishedAt = new Date('2020-01-01');
    postsRepository.findOne.mockResolvedValue({
      ...basePost,
      status: PostStatus.ARCHIVED,
      publishedAt,
    });
    const updated = await service.update('p1', { status: PostStatus.PUBLISHED });
    expect(updated.publishedAt).toEqual(publishedAt);
  });

  it('removes posts', async () => {
    postsRepository.findOne.mockResolvedValue({ ...basePost });
    await service.remove('p1');
    expect(postsRepository.remove).toHaveBeenCalled();
  });

  it('renders sanitized html including non-string marked output', async () => {
    const markedModule = await import('marked');
    const parse = markedModule.marked.parse as unknown as jest.Mock;
    parse.mockResolvedValueOnce(42);
    await expect(service.renderHtml('hi')).resolves.toBe('42');
    parse.mockResolvedValueOnce('<p>hi</p>');
    await expect(service.renderHtml('hi')).resolves.toBe('<p>hi</p>');
  });

  it('falls back to post slug when slugify is empty', async () => {
    const contentUtil = await import('../../common/utils/content.util');
    (contentUtil.slugify as jest.Mock).mockReturnValueOnce('');
    postsRepository.findOne.mockResolvedValue(null);
    const post = await service.create(author, {
      title: '???',
      content: 'body',
    });
    expect(post.slug).toBe('post');
  });

  it('validates schedule using existing scheduledAt when only status changes', async () => {
    const when = new Date(Date.now() + 60_000);
    postsRepository.findOne.mockResolvedValue({
      ...basePost,
      scheduledAt: when,
    });
    await service.update('p1', { status: PostStatus.SCHEDULED });
    expect(schedulerQueue.add).toHaveBeenCalled();
  });
});
