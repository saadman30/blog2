import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../domain/auth.types';
import { JwtTokenAdapter } from './jwt-token.adapter';

describe('JwtTokenAdapter', () => {
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  let configService: { get: jest.Mock };
  let adapter: JwtTokenAdapter;

  const payload: JwtPayload = {
    sub: 'u1',
    email: 'a@b.com',
    role: 'EDITOR',
  };

  beforeEach(() => {
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
    adapter = new JwtTokenAdapter(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('signs access token with configured expiry', async () => {
    await expect(adapter.signAccessToken(payload)).resolves.toBe('token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(payload, {
      secret: 'access',
      expiresIn: '15m',
    });
  });

  it('signs refresh token with configured expiry', async () => {
    await expect(adapter.signRefreshToken(payload)).resolves.toBe('token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(payload, {
      secret: 'refresh',
      expiresIn: '7d',
    });
  });

  it('uses default token expiry when config missing', async () => {
    configService.get.mockReturnValue(undefined);
    await adapter.signAccessToken(payload);
    await adapter.signRefreshToken(payload);
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, payload, {
      secret: undefined,
      expiresIn: '15m',
    });
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(2, payload, {
      secret: undefined,
      expiresIn: '7d',
    });
  });

  it('verifies refresh token', async () => {
    jwtService.verifyAsync.mockResolvedValue(payload);
    await expect(adapter.verifyRefreshToken('refresh')).resolves.toEqual(payload);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('refresh', {
      secret: 'refresh',
    });
  });
});
