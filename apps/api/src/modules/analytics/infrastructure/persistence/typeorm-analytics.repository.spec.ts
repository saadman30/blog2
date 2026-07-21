import { Repository } from 'typeorm';
import { AnalyticsEntity } from '../../../../database/entities';
import { TypeOrmAnalyticsRepository } from './typeorm-analytics.repository';

describe('TypeOrmAnalyticsRepository', () => {
  let repository: TypeOrmAnalyticsRepository;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  const entity = {
    id: 'a1',
    postId: 'p1',
    views: 2,
    claps: 3,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  } as AnalyticsEntity;

  beforeEach(() => {
    repo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...entity, ...v })),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    repository = new TypeOrmAnalyticsRepository(
      repo as unknown as Repository<AnalyticsEntity>,
    );
  });

  it('finds by postId', async () => {
    repo.findOne.mockResolvedValue(entity);
    await expect(repository.findByPostId('p1')).resolves.toMatchObject({
      id: 'a1',
      postId: 'p1',
    });
    repo.findOne.mockResolvedValue(null);
    await expect(repository.findByPostId('x')).resolves.toBeNull();
  });

  it('saves analytics', async () => {
    const result = await repository.save({
      postId: 'p1',
      views: 0,
      claps: 0,
    });
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(result.postId).toBe('p1');
  });

  it('finds all', async () => {
    repo.find.mockResolvedValue([entity]);
    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'a1' }),
    ]);
  });
});
