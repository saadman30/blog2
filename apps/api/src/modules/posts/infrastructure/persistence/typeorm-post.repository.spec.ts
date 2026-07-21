import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  PostEntity,
  PostStatus,
} from '../../../../database/entities';
import { Post } from '../../domain/post.model';
import { TypeOrmPostRepository } from './typeorm-post.repository';

describe('TypeOrmPostRepository', () => {
  let repository: TypeOrmPostRepository;
  let postsRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const entity = {
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
  } as unknown as PostEntity;

  beforeEach(() => {
    postsRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...entity, ...v })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    repository = new TypeOrmPostRepository(
      postsRepository as unknown as Repository<PostEntity>,
    );
  });

  it('saves posts', async () => {
    const saved = await repository.save({
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
    });
    expect(saved.id).toBe('p1');
    expect(postsRepository.save).toHaveBeenCalled();
  });

  it('finds by id and slug', async () => {
    postsRepository.findOne.mockResolvedValue(entity);
    await expect(repository.findById('p1')).resolves.toMatchObject({
      id: 'p1',
    });
    await expect(repository.findBySlug('hello')).resolves.toMatchObject({
      slug: 'hello',
    });
    await expect(
      repository.findBySlug('hello', false),
    ).resolves.toMatchObject({ slug: 'hello' });
  });

  it('returns null when missing', async () => {
    postsRepository.findOne.mockResolvedValue(null);
    await expect(repository.findById('x')).resolves.toBeNull();
    await expect(repository.findBySlug('x')).resolves.toBeNull();
    await expect(repository.findBySlugExact('x')).resolves.toBeNull();
  });

  it('lists admin and published posts', async () => {
    postsRepository.find.mockResolvedValue([entity]);
    await expect(repository.findAllAdmin()).resolves.toHaveLength(1);

    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([entity]),
    };
    postsRepository.createQueryBuilder.mockReturnValue(
      qb as unknown as SelectQueryBuilder<PostEntity>,
    );
    await expect(repository.findPublished()).resolves.toHaveLength(1);
    await expect(repository.findPublished('ts')).resolves.toHaveLength(1);
    expect(qb.andWhere).toHaveBeenCalled();
  });

  it('finds by exact slug', async () => {
    postsRepository.findOne.mockResolvedValue(entity);
    await expect(repository.findBySlugExact('hello')).resolves.toMatchObject({
      slug: 'hello',
    });
  });

  it('removes posts', async () => {
    const post = { ...entity } as unknown as Post;
    await repository.remove(post);
    expect(postsRepository.remove).toHaveBeenCalled();
  });
});
