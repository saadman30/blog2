import { Repository } from 'typeorm';
import { MediaEntity } from '../../../../database/entities';
import { TypeOrmMediaRepository } from './typeorm-media.repository';

describe('TypeOrmMediaRepository', () => {
  let repository: TypeOrmMediaRepository;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };

  const entity = {
    id: 'm1',
    url: '/uploads/a.webp',
    key: 'a.webp',
    mimeType: 'image/webp',
    size: 4,
    alt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  } as MediaEntity;

  beforeEach(() => {
    repo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...entity, ...v })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    repository = new TypeOrmMediaRepository(
      repo as unknown as Repository<MediaEntity>,
    );
  });

  it('saves media', async () => {
    const result = await repository.save({
      url: '/uploads/a.webp',
      key: 'a.webp',
      mimeType: 'image/webp',
      size: 4,
      alt: null,
    });
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(result.id).toBe('m1');
    expect(result.key).toBe('a.webp');
  });

  it('finds all ordered by createdAt DESC', async () => {
    repo.find.mockResolvedValue([entity]);
    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'm1' }),
    ]);
    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });

  it('finds by id', async () => {
    repo.findOne.mockResolvedValue(entity);
    await expect(repository.findById('m1')).resolves.toMatchObject({ id: 'm1' });
    repo.findOne.mockResolvedValue(null);
    await expect(repository.findById('x')).resolves.toBeNull();
  });

  it('removes when entity exists', async () => {
    repo.findOne.mockResolvedValue(entity);
    await repository.remove({
      id: 'm1',
      url: '/uploads/a.webp',
      key: 'a.webp',
      mimeType: 'image/webp',
      size: 4,
      alt: null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
    expect(repo.remove).toHaveBeenCalledWith(entity);
  });

  it('skips remove when entity missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await repository.remove({
      id: 'x',
      url: '/uploads/x.webp',
      key: 'x.webp',
      mimeType: 'image/webp',
      size: 1,
      alt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(repo.remove).not.toHaveBeenCalled();
  });
});
