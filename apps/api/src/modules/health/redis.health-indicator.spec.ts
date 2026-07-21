import { HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { RedisHealthIndicator } from './redis.health-indicator';

const mockPing = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    ping: mockPing,
    disconnect: mockDisconnect,
  })),
);

describe('RedisHealthIndicator', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'redis.host') return 'localhost';
      if (key === 'redis.port') return 6379;
      return undefined;
    }),
  } as unknown as ConfigService;

  let indicator: RedisHealthIndicator;

  beforeEach(() => {
    indicator = new RedisHealthIndicator(configService);
    mockPing.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    mockConnect.mockResolvedValue(undefined);
  });

  it('returns healthy status when redis responds with PONG', async () => {
    mockPing.mockResolvedValue('PONG');
    await expect(indicator.isHealthy('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('throws when redis responds with an unexpected payload', async () => {
    mockPing.mockResolvedValue('NOPE');
    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('throws when redis connection fails', async () => {
    mockConnect.mockRejectedValue(new Error('connection refused'));
    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('uses defaults when redis config is missing', async () => {
    const fallbackConfig = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    const fallbackIndicator = new RedisHealthIndicator(fallbackConfig);
    mockPing.mockResolvedValue('PONG');
    await expect(fallbackIndicator.isHealthy('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('handles non-error thrown values', async () => {
    mockConnect.mockRejectedValue('offline');
    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});
