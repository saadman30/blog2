import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { DataSource } from 'typeorm';
import { TYPEORM_POOL_CONNECTIONS } from './metrics.constants';

interface PgPool {
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
}

@Injectable()
export class TypeOrmPoolMetrics implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectMetric(TYPEORM_POOL_CONNECTIONS)
    private readonly poolGauge: Gauge<string>,
  ) {}

  onModuleInit(): void {
    this.collect();
    this.intervalId = setInterval(() => this.collect(), 15_000);
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  collect(): void {
    const pool = this.getPool();
    if (!pool) {
      return;
    }

    this.poolGauge.set({ state: 'total' }, pool.totalCount ?? 0);
    this.poolGauge.set({ state: 'idle' }, pool.idleCount ?? 0);
    this.poolGauge.set({ state: 'waiting' }, pool.waitingCount ?? 0);
  }

  private getPool(): PgPool | null {
    const driver = this.dataSource.driver as {
      master?: PgPool;
    };

    return driver.master ?? null;
  }
}
