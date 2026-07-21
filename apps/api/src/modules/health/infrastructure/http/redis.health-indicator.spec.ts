import { HealthCheckError } from '@nestjs/terminus';
import { CacheHealthPort } from '../../application/ports/cache-health.port';
import { RedisHealthIndicator } from './redis.health-indicator';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let cacheHealth: jest.Mocked<CacheHealthPort>;

  beforeEach(() => {
    cacheHealth = {
      check: jest.fn(),
    };
    indicator = new RedisHealthIndicator(cacheHealth);
  });

  it('returns healthy status when cache check succeeds', async () => {
    cacheHealth.check.mockResolvedValue({ ok: true });
    await expect(indicator.isHealthy('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('throws when cache check fails', async () => {
    cacheHealth.check.mockResolvedValue({
      ok: false,
      message: 'connection refused',
    });
    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});
