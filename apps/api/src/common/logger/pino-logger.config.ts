import { IncomingMessage } from 'node:http';
import { context, trace } from '@opentelemetry/api';
import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';

const shouldIgnoreRequest = (request: IncomingMessage): boolean => {
  const url = request.url ?? '';
  return url.includes('/health') || url.includes('/metrics');
};

export function createPinoLoggerConfig(configService: ConfigService): Params {
  const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';

  return {
    pinoHttp: {
      level: nodeEnv === 'production' ? 'info' : 'debug',
      mixin() {
        const span = trace.getSpan(context.active());
        if (!span) {
          return {};
        }

        const { traceId, spanId } = span.spanContext();
        return {
          trace_id: traceId,
          span_id: spanId,
        };
      },
      autoLogging: {
        ignore: shouldIgnoreRequest,
      },
    },
  };
}
