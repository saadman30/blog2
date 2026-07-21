import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { RedisHealthIndicator } from './redis.health-indicator';

const MEMORY_HEAP_LIMIT_BYTES = 300 * 1024 * 1024;

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Public()
  @Get('liveness')
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', MEMORY_HEAP_LIMIT_BYTES),
    ]);
  }

  @Public()
  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.database.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', MEMORY_HEAP_LIMIT_BYTES),
    ]);
  }
}
