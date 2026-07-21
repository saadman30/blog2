import { Gauge } from 'prom-client';
import { DataSource } from 'typeorm';
import { TypeOrmPoolMetrics } from './typeorm-pool.metrics';

describe('TypeOrmPoolMetrics', () => {
  const poolGauge = {
    set: jest.fn(),
  } as unknown as Gauge<string>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('collects pool metrics on init and interval', () => {
    const dataSource = {
      driver: {
        master: {
          totalCount: 10,
          idleCount: 4,
          waitingCount: 1,
        },
      },
    } as unknown as DataSource;

    const metrics = new TypeOrmPoolMetrics(dataSource, poolGauge);
    metrics.onModuleInit();

    expect(poolGauge.set).toHaveBeenCalledWith({ state: 'total' }, 10);
    expect(poolGauge.set).toHaveBeenCalledWith({ state: 'idle' }, 4);
    expect(poolGauge.set).toHaveBeenCalledWith({ state: 'waiting' }, 1);

    jest.advanceTimersByTime(15_000);
    expect(poolGauge.set).toHaveBeenCalledTimes(6);

    metrics.onModuleDestroy();
    jest.advanceTimersByTime(15_000);
    expect(poolGauge.set).toHaveBeenCalledTimes(6);
  });

  it('skips collection when pool is unavailable', () => {
    const dataSource = {
      driver: {},
    } as unknown as DataSource;

    const metrics = new TypeOrmPoolMetrics(dataSource, poolGauge);
    metrics.collect();
    expect(poolGauge.set).not.toHaveBeenCalled();
  });

  it('defaults missing pool counts to zero', () => {
    const dataSource = {
      driver: {
        master: {},
      },
    } as unknown as DataSource;

    const metrics = new TypeOrmPoolMetrics(dataSource, poolGauge);
    metrics.collect();

    expect(poolGauge.set).toHaveBeenCalledWith({ state: 'total' }, 0);
    expect(poolGauge.set).toHaveBeenCalledWith({ state: 'idle' }, 0);
    expect(poolGauge.set).toHaveBeenCalledWith({ state: 'waiting' }, 0);
  });
});
