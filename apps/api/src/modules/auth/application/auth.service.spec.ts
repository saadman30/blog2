import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../../domain';
import {
  AuthTokens,
  JwtPayload,
} from '../domain/auth.types';
import { User } from '../domain/user.model';
import { AuthService } from './auth.service';
import { PasswordHasherPort } from './ports/password-hasher.port';
import { TokenServicePort } from './ports/token-service.port';
import { UserRepositoryPort } from './ports/user.repository.port';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UserRepositoryPort>;
  let passwordHasher: jest.Mocked<PasswordHasherPort>;
  let tokenService: jest.Mocked<TokenServicePort>;

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

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    tokenService = {
      signAccessToken: jest.fn().mockResolvedValue('token'),
      signRefreshToken: jest.fn().mockResolvedValue('token'),
      verifyRefreshToken: jest.fn(),
    };
    service = new AuthService(users, passwordHasher, tokenService);
  });

  it('registers a new user', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed');
    users.create.mockResolvedValue(user);
    const result = await service.register({
      email: 'A@B.com',
      password: 'password1',
    });
    expect(result.user.email).toBe('a@b.com');
    expect(result.tokens.accessToken).toBe('token');
  });

  it('always assigns editor role on register', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed');
    users.create.mockImplementation(async (data) => ({
      ...user,
      ...data,
      id: 'u2',
      createdAt: new Date(),
      updatedAt: new Date(),
      posts: [],
      comments: [],
    }));
    const result = await service.register({
      email: 'admin@b.com',
      password: 'password1',
    });
    expect(result.user.role).toBe(UserRole.EDITOR);
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.EDITOR }),
    );
  });

  it('rejects duplicate email', async () => {
    users.findByEmail.mockResolvedValue(user);
    await expect(
      service.register({ email: 'a@b.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    users.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(true);
    const result = await service.login({ email: 'a@b.com', password: 'password1' });
    expect(result.tokens.refreshToken).toBe('token');
  });

  it('rejects unknown user', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@y.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid password', async () => {
    users.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(false);
    await expect(
      service.login({ email: 'a@b.com', password: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enforces two-factor when enabled', async () => {
    const tfaUser = { ...user, twoFactorEnabled: true, twoFactorSecret: '123456' };
    users.findByEmail.mockResolvedValue(tfaUser);
    passwordHasher.compare.mockResolvedValue(true);
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
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      role: 'EDITOR',
    } satisfies JwtPayload);
    users.findById.mockResolvedValue(user);
    const tokens = await service.refresh('refresh');
    expect(tokens.accessToken).toBe('token');
  });

  it('rejects refresh when user missing', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      role: 'EDITOR',
    });
    users.findById.mockResolvedValue(null);
    await expect(service.refresh('refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid refresh token', async () => {
    tokenService.verifyRefreshToken.mockRejectedValue(new Error('bad'));
    await expect(service.refresh('bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('validateUserById delegates to repository', async () => {
    users.findById.mockResolvedValue(user);
    await expect(service.validateUserById('u1')).resolves.toEqual(user);
  });

  it('enableTwoFactor updates user', async () => {
    users.findById.mockResolvedValue({ ...user });
    users.save.mockImplementation(async (u) => u);
    const updated = await service.enableTwoFactor('u1', 'secret');
    expect(updated.twoFactorEnabled).toBe(true);
    expect(updated.twoFactorSecret).toBe('secret');
  });

  it('enableTwoFactor throws when user missing', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.enableTwoFactor('x', 's')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('issues access and refresh tokens', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed');
    users.create.mockResolvedValue(user);
    const result = await service.register({ email: 'n@b.com', password: 'password1' });
    expect(result.tokens).toEqual({ accessToken: 'token', refreshToken: 'token' } satisfies AuthTokens);
    expect(tokenService.signAccessToken).toHaveBeenCalled();
    expect(tokenService.signRefreshToken).toHaveBeenCalled();
  });
});
