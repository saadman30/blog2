import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole } from '../../database/entities';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<Pick<Repository<UserEntity>, 'findOne' | 'create' | 'save'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  let configService: { get: jest.Mock };

  const user: UserEntity = {
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

  beforeEach(() => {
    usersRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('token'),
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'jwt.accessSecret') return 'access';
        if (key === 'jwt.refreshSecret') return 'refresh';
        if (key === 'jwt.accessExpiresIn') return '15m';
        if (key === 'jwt.refreshExpiresIn') return '7d';
        return undefined;
      }),
    };
    service = new AuthService(
      usersRepository as unknown as Repository<UserEntity>,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('registers a new user', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    usersRepository.create.mockReturnValue(user);
    usersRepository.save.mockResolvedValue(user);
    const result = await service.register({
      email: 'A@B.com',
      password: 'password1',
    });
    expect(result.user.email).toBe('a@b.com');
    expect(result.tokens.accessToken).toBe('token');
  });

  it('always assigns editor role on register', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    usersRepository.create.mockImplementation((data) => data as UserEntity);
    usersRepository.save.mockImplementation(async (u) => u as UserEntity);
    const result = await service.register({
      email: 'admin@b.com',
      password: 'password1',
    });
    expect(result.user.role).toBe(UserRole.EDITOR);
    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.EDITOR }),
    );
  });

  it('rejects duplicate email', async () => {
    usersRepository.findOne.mockResolvedValue(user);
    await expect(
      service.register({ email: 'a@b.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    usersRepository.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const result = await service.login({ email: 'a@b.com', password: 'password1' });
    expect(result.tokens.refreshToken).toBe('token');
  });

  it('rejects unknown user', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@y.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid password', async () => {
    usersRepository.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.login({ email: 'a@b.com', password: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enforces two-factor when enabled', async () => {
    const tfaUser = { ...user, twoFactorEnabled: true, twoFactorSecret: '123456' };
    usersRepository.findOne.mockResolvedValue(tfaUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await expect(
      service.login({ email: 'a@b.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ email: 'a@b.com', password: 'password1', twoFactorCode: '000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const ok = await service.login({
      email: 'a@b.com',
      password: 'password1',
      twoFactorCode: '123456',
    });
    expect(ok.user.id).toBe('u1');
  });

  it('refreshes tokens', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      role: 'EDITOR',
    });
    usersRepository.findOne.mockResolvedValue(user);
    const tokens = await service.refresh('refresh');
    expect(tokens.accessToken).toBe('token');
  });

  it('rejects refresh when user missing', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      role: 'EDITOR',
    });
    usersRepository.findOne.mockResolvedValue(null);
    await expect(service.refresh('refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid refresh token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad'));
    await expect(service.refresh('bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('validateUserById delegates to repository', async () => {
    usersRepository.findOne.mockResolvedValue(user);
    await expect(service.validateUserById('u1')).resolves.toEqual(user);
  });

  it('enableTwoFactor updates user', async () => {
    usersRepository.findOne.mockResolvedValue({ ...user });
    usersRepository.save.mockImplementation(async (u) => u as UserEntity);
    const updated = await service.enableTwoFactor('u1', 'secret');
    expect(updated.twoFactorEnabled).toBe(true);
    expect(updated.twoFactorSecret).toBe('secret');
  });

  it('enableTwoFactor throws when user missing', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    await expect(service.enableTwoFactor('x', 's')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('uses default token expiry when config missing', async () => {
    configService.get.mockReturnValue(undefined);
    usersRepository.findOne.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    usersRepository.create.mockReturnValue(user);
    usersRepository.save.mockResolvedValue(user);
    await service.register({ email: 'n@b.com', password: 'password1' });
    expect(jwtService.signAsync).toHaveBeenCalled();
  });
});
