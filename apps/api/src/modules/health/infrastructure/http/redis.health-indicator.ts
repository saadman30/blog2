import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import {
  CACHE_HEALTH,
  CacheHealthPort,
} from '../../application/ports/cache-health.port';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(CACHE_HEALTH) private readonly cacheHealth: CacheHealthPort,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const result = await this.cacheHealth.check();
    if (!result.ok) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: result.message }),
      );
    }
    return this.getStatus(key, true);
  }
}
