import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import {
  HTTP_REQUEST_DURATION,
  HTTP_REQUEST_ERRORS_TOTAL,
  HTTP_REQUESTS_TOTAL,
  TYPEORM_POOL_CONNECTIONS,
} from './metrics.constants';

export const httpMetricsProviders = [
  makeHistogramProvider({
    name: HTTP_REQUEST_DURATION,
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }),
  makeCounterProvider({
    name: HTTP_REQUESTS_TOTAL,
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  }),
  makeCounterProvider({
    name: HTTP_REQUEST_ERRORS_TOTAL,
    help: 'Total number of HTTP request errors',
    labelNames: ['method', 'route', 'status_code'],
  }),
  makeGaugeProvider({
    name: TYPEORM_POOL_CONNECTIONS,
    help: 'TypeORM PostgreSQL connection pool metrics',
    labelNames: ['state'],
  }),
];
