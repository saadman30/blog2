import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('delegates liveness and readiness checks to Terminus', async () => {
    const health = {
      check: jest.fn().mockResolvedValue({ status: 'ok' }),
    };
    const database = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    const redis = {
      isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
    };
    const memory = {
      checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
    };

    const controller = new HealthController(
      health as never,
      database as never,
      redis as never,
      memory as never,
    );

    await expect(controller.liveness()).resolves.toEqual({ status: 'ok' });
    await expect(controller.readiness()).resolves.toEqual({ status: 'ok' });

    expect(health.check).toHaveBeenCalledTimes(2);
    expect(health.check.mock.calls[0][0]).toHaveLength(1);
    expect(health.check.mock.calls[1][0]).toHaveLength(3);

    const livenessChecks = health.check.mock.calls[0][0] as Array<
      () => Promise<unknown>
    >;
    await livenessChecks[0]();
    expect(memory.checkHeap).toHaveBeenCalledWith(
      'memory_heap',
      300 * 1024 * 1024,
    );

    const readinessChecks = health.check.mock.calls[1][0] as Array<
      () => Promise<unknown>
    >;
    await readinessChecks[0]();
    await readinessChecks[1]();
    await readinessChecks[2]();

    expect(database.pingCheck).toHaveBeenCalledWith('database');
    expect(redis.isHealthy).toHaveBeenCalledWith('redis');
    expect(memory.checkHeap).toHaveBeenCalledWith(
      'memory_heap',
      300 * 1024 * 1024,
    );
  });
});
