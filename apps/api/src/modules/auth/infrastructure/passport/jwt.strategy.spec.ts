import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../../../domain';
import { UserRepositoryPort } from '../../application/ports/user.repository.port';
import { User } from '../../domain/user.model';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('validates payload against repository', async () => {
    const user: User = {
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
    };
    const users: UserRepositoryPort = {
      findById: jest.fn().mockResolvedValue(user),
      findByEmail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config, users);
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'EDITOR' }),
    ).resolves.toEqual(user);
  });

  it('falls back to default secret', async () => {
    const users: UserRepositoryPort = {
      findById: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config, users);
    await expect(
      strategy.validate({ sub: 'missing', email: 'a@b.com', role: 'EDITOR' }),
    ).resolves.toBeNull();
  });
});
