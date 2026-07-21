import { ConfigService } from '@nestjs/config';
import { IoRedisCacheHealthAdapter } from './ioredis-cache-health.adapter';

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

describe('IoRedisCacheHealthAdapter', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'redis.host') return 'localhost';
      if (key === 'redis.port') return 6379;
      return undefined;
    }),
  } as unknown as ConfigService;

  let adapter: IoRedisCacheHealthAdapter;

  beforeEach(() => {
    adapter = new IoRedisCacheHealthAdapter(configService);
    mockPing.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    mockConnect.mockResolvedValue(undefined);
  });

  it('returns ok when redis responds with PONG', async () => {
    mockPing.mockResolvedValue('PONG');
    await expect(adapter.check()).resolves.toEqual({ ok: true });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('returns failure when redis responds with unexpected payload', async () => {
    mockPing.mockResolvedValue('NOPE');
    await expect(adapter.check()).resolves.toEqual({
      ok: false,
      message: 'Unexpected ping response: NOPE',
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('returns failure when redis connection fails', async () => {
    mockConnect.mockRejectedValue(new Error('connection refused'));
    await expect(adapter.check()).resolves.toEqual({
      ok: false,
      message: 'connection refused',
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('uses defaults when redis config is missing', async () => {
    const fallbackConfig = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    const fallbackAdapter = new IoRedisCacheHealthAdapter(fallbackConfig);
    mockPing.mockResolvedValue('PONG');
    await expect(fallbackAdapter.check()).resolves.toEqual({ ok: true });
  });

  it('handles non-error thrown values', async () => {
    mockConnect.mockRejectedValue('offline');
    await expect(adapter.check()).resolves.toEqual({
      ok: false,
      message: 'Unknown error',
    });
  });
});
