import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

const mockPing = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    ping: mockPing,
    disconnect: mockDisconnect,
  })),
);

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: { query: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'redis.host') return 'localhost';
        if (key === 'redis.port') return 6379;
        return undefined;
      }),
    };
    service = new HealthService(
      dataSource as unknown as DataSource,
      configService as unknown as ConfigService,
    );
    mockPing.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    mockConnect.mockResolvedValue(undefined);
  });

  it('returns ok when dependencies healthy', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    mockPing.mockResolvedValue('PONG');
    const report = await service.check();
    expect(report.status).toBe('ok');
    expect(report.database).toBe('ok');
    expect(report.redis).toBe('ok');
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('returns error when database fails', async () => {
    dataSource.query.mockRejectedValue(new Error('db'));
    mockPing.mockResolvedValue('PONG');
    const report = await service.check();
    expect(report.status).toBe('error');
    expect(report.database).toBe('error');
  });

  it('returns error when redis ping is unexpected', async () => {
    dataSource.query.mockResolvedValue([]);
    mockPing.mockResolvedValue('NOPE');
    const report = await service.check();
    expect(report.redis).toBe('error');
  });

  it('returns error when redis connect fails', async () => {
    dataSource.query.mockResolvedValue([]);
    mockConnect.mockRejectedValue(new Error('redis'));
    configService.get.mockReturnValue(undefined);
    const report = await service.check();
    expect(report.redis).toBe('error');
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
