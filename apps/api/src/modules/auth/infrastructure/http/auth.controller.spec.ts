import { UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from '../../application/auth.service';
import { UserRole } from '../../../../domain';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'register' | 'login' | 'refresh'>
  >;
  let res: Pick<Response, 'cookie' | 'clearCookie'>;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
    };
    res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    controller = new AuthController(authService as unknown as AuthService);
    process.env.NODE_ENV = 'test';
  });

  const authResult = {
    user: {
      id: 'u1',
      email: 'a@b.com',
      role: UserRole.EDITOR,
      twoFactorEnabled: false,
      posts: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    tokens: { accessToken: 'a', refreshToken: 'r' },
  };

  it('register sets cookie and returns access token', async () => {
    authService.register.mockResolvedValue(authResult);
    const result = await controller.register(
      { email: 'a@b.com', password: 'password1' },
      res as Response,
    );
    expect(result.accessToken).toBe('a');
    expect(res.cookie).toHaveBeenCalled();
  });

  it('login sets cookie', async () => {
    authService.login.mockResolvedValue(authResult);
    const result = await controller.login(
      { email: 'a@b.com', password: 'password1' },
      res as Response,
    );
    expect(result.user.email).toBe('a@b.com');
  });

  it('refresh requires cookie', async () => {
    await expect(
      controller.refresh({ cookies: {} } as Request, res as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh rotates tokens', async () => {
    authService.refresh.mockResolvedValue({ accessToken: 'na', refreshToken: 'nr' });
    const result = await controller.refresh(
      { cookies: { refreshToken: 'old' } } as unknown as Request,
      res as Response,
    );
    expect(result.accessToken).toBe('na');
  });

  it('logout clears cookie', () => {
    expect(controller.logout(res as Response)).toEqual({ loggedOut: true });
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('sets secure cookie in production', async () => {
    process.env.NODE_ENV = 'production';
    authService.login.mockResolvedValue(authResult);
    await controller.login(
      { email: 'a@b.com', password: 'password1' },
      res as Response,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'r',
      expect.objectContaining({ secure: true, sameSite: 'strict', httpOnly: true }),
    );
  });
});
