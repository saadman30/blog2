import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('exposes health endpoints', async () => {
    const healthService = {
      check: jest.fn().mockResolvedValue({
        status: 'ok',
        database: 'ok',
        redis: 'ok',
        uptime: 1,
      }),
    } as unknown as HealthService;
    const controller = new HealthController(healthService);
    await expect(controller.check()).resolves.toMatchObject({ status: 'ok' });
    expect(controller.live()).toEqual({ status: 'ok' });
  });
});
