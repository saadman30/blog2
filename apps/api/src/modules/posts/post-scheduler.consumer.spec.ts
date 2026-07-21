import { Job } from 'bullmq';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PostEntity, PostStatus } from '../../database/entities';
import { PostSchedulerConsumer, PublishPostJob } from './post-scheduler.consumer';

describe('PostSchedulerConsumer', () => {
  let consumer: PostSchedulerConsumer;
  let postsRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const post: PostEntity = {
    id: 'p1',
    title: 't',
    slug: 't',
    content: 'c',
    summary: null,
    readingTime: 1,
    status: PostStatus.SCHEDULED,
    scheduledAt: new Date(Date.now() - 1000),
    publishedAt: null,
    tags: [],
    category: null,
    authorId: 'a1',
    author: undefined as never,
    comments: [],
    analytics: undefined as never,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    postsRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (p) => p),
      createQueryBuilder: jest.fn(),
    };
    consumer = new PostSchedulerConsumer(
      postsRepository as unknown as Repository<PostEntity>,
    );
  });

  it('publishes a due scheduled post', async () => {
    postsRepository.findOne.mockResolvedValue({ ...post });
    const result = await consumer.process({
      name: 'publish-post',
      data: { postId: 'p1' },
    } as Job<PublishPostJob>);
    expect(result).toEqual({ published: true });
  });

  it('skips missing or non-scheduled posts', async () => {
    postsRepository.findOne.mockResolvedValue(null);
    await expect(
      consumer.process({
        name: 'publish-post',
        data: { postId: 'x' },
      } as Job<PublishPostJob>),
    ).resolves.toEqual({ published: false });

    postsRepository.findOne.mockResolvedValue({
      ...post,
      status: PostStatus.DRAFT,
    });
    await expect(
      consumer.process({
        name: 'publish-post',
        data: { postId: 'p1' },
      } as Job<PublishPostJob>),
    ).resolves.toEqual({ published: false });
  });

  it('skips posts not yet due', async () => {
    postsRepository.findOne.mockResolvedValue({
      ...post,
      scheduledAt: new Date(Date.now() + 60_000),
    });
    await expect(
      consumer.process({
        name: 'publish-post',
        data: { postId: 'p1' },
      } as Job<PublishPostJob>),
    ).resolves.toEqual({ published: false });
  });

  it('publishes all due posts via publish-due job', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ ...post }, { ...post, id: 'p2' }]),
    };
    postsRepository.createQueryBuilder.mockReturnValue(
      qb as unknown as SelectQueryBuilder<PostEntity>,
    );
    await expect(
      consumer.process({
        name: 'publish-due',
        data: { postId: '' },
      } as Job<PublishPostJob>),
    ).resolves.toEqual({ published: true });
  });

  it('returns published false when no due posts', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    postsRepository.createQueryBuilder.mockReturnValue(
      qb as unknown as SelectQueryBuilder<PostEntity>,
    );
    await expect(
      consumer.process({
        name: 'publish-due',
        data: { postId: '' },
      } as Job<PublishPostJob>),
    ).resolves.toEqual({ published: false });
  });
});
