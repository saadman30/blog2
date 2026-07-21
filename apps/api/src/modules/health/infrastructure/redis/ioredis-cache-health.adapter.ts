import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheHealthPort } from '../../application/ports/cache-health.port';

@Injectable()
export class IoRedisCacheHealthAdapter implements CacheHealthPort {
  constructor(private readonly configService: ConfigService) {}

  async check(): Promise<{ ok: boolean; message?: string }> {
    const host = this.configService.get<string>('redis.host') ?? 'localhost';
    const port = this.configService.get<number>('redis.port') ?? 6379;
    const client = new Redis({
      host,
      port,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      if (pong !== 'PONG') {
        return {
          ok: false,
          message: `Unexpected ping response: ${pong}`,
        };
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      client.disconnect();
    }
  }
}
