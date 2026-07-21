import { UserEntity } from '../../../../database/entities';
import { UserRole } from '../../../../domain';
import { UserMapper } from './user.mapper';

describe('UserMapper', () => {
  const entity = {
    id: 'u1',
    email: 'a@b.com',
    password: 'hashed',
    role: UserRole.EDITOR,
    twoFactorSecret: null,
    twoFactorEnabled: false,
    posts: [],
    comments: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  } as UserEntity;

  it('maps entity to domain', () => {
    expect(UserMapper.toDomain(entity)).toEqual({
      id: 'u1',
      email: 'a@b.com',
      password: 'hashed',
      role: UserRole.EDITOR,
      twoFactorSecret: null,
      twoFactorEnabled: false,
      posts: [],
      comments: [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  });

  it('defaults missing relations to empty arrays', () => {
    const bare = {
      ...entity,
      posts: undefined,
      comments: undefined,
    } as unknown as UserEntity;
    const domain = UserMapper.toDomain(bare);
    expect(domain.posts).toEqual([]);
    expect(domain.comments).toEqual([]);
  });

  it('maps create data to entity fields', () => {
    expect(
      UserMapper.toCreateEntity({
        email: 'a@b.com',
        password: 'hashed',
        role: UserRole.ADMIN,
        twoFactorSecret: null,
        twoFactorEnabled: false,
      }),
    ).toEqual({
      email: 'a@b.com',
      password: 'hashed',
      role: UserRole.ADMIN,
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });
  });

  it('maps domain user to persistence fields', () => {
    const user = UserMapper.toDomain(entity);
    expect(UserMapper.toPersistence(user)).toEqual({
      id: 'u1',
      email: 'a@b.com',
      password: 'hashed',
      role: UserRole.EDITOR,
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });
  });
});
