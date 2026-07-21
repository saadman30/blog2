import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../database/entities';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('validates payload against repository', async () => {
    const user = { id: 'u1' } as UserEntity;
    const repo = {
      findOne: jest.fn().mockResolvedValue(user),
    } as unknown as Repository<UserEntity>;
    const config = {
      get: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config, repo);
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'EDITOR' }),
    ).resolves.toEqual(user);
  });

  it('falls back to default secret', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<UserEntity>;
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config, repo);
    await expect(
      strategy.validate({ sub: 'missing', email: 'a@b.com', role: 'EDITOR' }),
    ).resolves.toBeNull();
  });
});
