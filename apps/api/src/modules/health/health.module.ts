import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CACHE_HEALTH } from './application/ports/cache-health.port';
import { HealthController } from './infrastructure/http/health.controller';
import { RedisHealthIndicator } from './infrastructure/http/redis.health-indicator';
import { IoRedisCacheHealthAdapter } from './infrastructure/redis/ioredis-cache-health.adapter';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    { provide: CACHE_HEALTH, useClass: IoRedisCacheHealthAdapter },
  ],
})
export class HealthModule {}
