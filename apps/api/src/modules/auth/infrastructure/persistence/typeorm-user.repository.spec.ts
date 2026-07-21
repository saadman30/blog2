import { Repository } from 'typeorm';
import { UserEntity } from '../../../../database/entities';
import { UserRole } from '../../../../domain';
import { User } from '../../domain/user.model';
import { TypeOrmUserRepository } from './typeorm-user.repository';

describe('TypeOrmUserRepository', () => {
  let repo: jest.Mocked<
    Pick<Repository<UserEntity>, 'findOne' | 'create' | 'save'>
  >;
  let adapter: TypeOrmUserRepository;

  const entity = {
    id: 'u1',
    email: 'a@b.com',
    password: 'hashed',
    role: UserRole.EDITOR,
    twoFactorSecret: null,
    twoFactorEnabled: false,
    posts: [],
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserEntity;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    adapter = new TypeOrmUserRepository(
      repo as unknown as Repository<UserEntity>,
    );
  });

  it('findByEmail returns domain user', async () => {
    repo.findOne.mockResolvedValue(entity);
    await expect(adapter.findByEmail('a@b.com')).resolves.toMatchObject({
      id: 'u1',
      email: 'a@b.com',
    });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
  });

  it('findByEmail returns null when missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(adapter.findByEmail('x@y.com')).resolves.toBeNull();
  });

  it('findById returns domain user', async () => {
    repo.findOne.mockResolvedValue(entity);
    await expect(adapter.findById('u1')).resolves.toMatchObject({ id: 'u1' });
  });

  it('findById returns null when missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(adapter.findById('missing')).resolves.toBeNull();
  });

  it('create persists and returns domain user', async () => {
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);
    const result = await adapter.create({
      email: 'a@b.com',
      password: 'hashed',
      role: UserRole.EDITOR,
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });
    expect(result.id).toBe('u1');
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('save persists domain user', async () => {
    const user: User = {
      id: 'u1',
      email: 'a@b.com',
      password: 'hashed',
      role: UserRole.EDITOR,
      twoFactorSecret: 'sec',
      twoFactorEnabled: true,
      posts: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repo.save.mockResolvedValue({ ...entity, ...user } as UserEntity);
    const result = await adapter.save(user);
    expect(result.twoFactorEnabled).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });
});
