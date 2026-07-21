import { ConfigService } from '@nestjs/config';
import { trace } from '@opentelemetry/api';
import { IncomingMessage } from 'node:http';
import { createPinoLoggerConfig } from './pino-logger.config';

type PinoHttpConfig = {
  level?: string;
  mixin?: () => Record<string, string>;
  autoLogging?: { ignore?: (request: IncomingMessage) => boolean };
};

describe('createPinoLoggerConfig', () => {
  const createConfigService = (nodeEnv?: string): ConfigService =>
    ({
      get: jest.fn((key: string) => {
        if (key === 'app.nodeEnv') {
          return nodeEnv;
        }
        return undefined;
      }),
    }) as unknown as ConfigService;

  const getPinoHttp = (nodeEnv?: string): PinoHttpConfig =>
    createPinoLoggerConfig(createConfigService(nodeEnv)).pinoHttp as PinoHttpConfig;

  it('uses debug logging in non-production', () => {
    expect(getPinoHttp('development').level).toBe('debug');
  });

  it('uses info logging in production', () => {
    expect(getPinoHttp('production').level).toBe('info');
  });

  it('ignores health and metrics requests', () => {
    const ignore = getPinoHttp().autoLogging?.ignore;
    expect(ignore?.({ url: '/health/liveness' } as IncomingMessage)).toBe(true);
    expect(ignore?.({ url: '/metrics' } as IncomingMessage)).toBe(true);
    expect(ignore?.({ url: '/api/posts' } as IncomingMessage)).toBe(false);
    expect(ignore?.({} as IncomingMessage)).toBe(false);
  });

  it('adds trace context when a span is active', () => {
    const mixin = getPinoHttp().mixin;
    const getSpanSpy = jest.spyOn(trace, 'getSpan').mockReturnValue({
      spanContext: () => ({
        traceId: 'trace-123',
        spanId: 'span-456',
      }),
    } as never);

    expect(mixin?.()).toEqual({
      trace_id: 'trace-123',
      span_id: 'span-456',
    });

    getSpanSpy.mockReturnValue(undefined);
    expect(mixin?.()).toEqual({});
    getSpanSpy.mockRestore();
  });

  it('defaults node env to development', () => {
    expect(getPinoHttp().level).toBe('debug');
  });
});
