import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type HealthStatus = 'ok' | 'error';

export interface HealthReport {
  status: HealthStatus;
  database: HealthStatus;
  redis: HealthStatus;
  uptime: number;
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const status: HealthStatus =
      database === 'ok' && redis === 'ok' ? 'ok' : 'error';
    return {
      status,
      database,
      redis,
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  private async checkDatabase(): Promise<HealthStatus> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<HealthStatus> {
    const host = this.configService.get<string>('redis.host') ?? 'localhost';
    const port = this.configService.get<number>('redis.port') ?? 6379;
    const client = new Redis({ host, port, maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    } finally {
      client.disconnect();
    }
  }
}
