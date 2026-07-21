import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  HTTP_REQUEST_DURATION,
  HTTP_REQUEST_ERRORS_TOTAL,
  HTTP_REQUESTS_TOTAL,
} from '../metrics/metrics.constants';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUEST_DURATION)
    private readonly durationHistogram: Histogram<string>,
    @InjectMetric(HTTP_REQUESTS_TOTAL)
    private readonly requestsCounter: Counter<string>,
    @InjectMetric(HTTP_REQUEST_ERRORS_TOTAL)
    private readonly errorsCounter: Counter<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();
    const route = this.resolveRoute(request);

    return next.handle().pipe(
      tap(() => {
        this.recordMetrics(request.method, route, response.statusCode, startedAt);
      }),
      catchError((error: { status?: number }) => {
        const statusCode = error.status ?? 500;
        this.recordMetrics(request.method, route, statusCode, startedAt, true);
        return throwError(() => error);
      }),
    );
  }

  private resolveRoute(request: Request): string {
    const routePath = request.route?.path;
    if (typeof routePath === 'string') {
      return routePath;
    }

    return request.path;
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: number,
    startedAt: bigint,
    isError = false,
  ): void {
    const labels = {
      method,
      route,
      status_code: String(statusCode),
    };

    const durationSeconds =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

    this.durationHistogram.observe(labels, durationSeconds);
    this.requestsCounter.inc(labels);

    if (isError || statusCode >= 400) {
      this.errorsCounter.inc(labels);
    }
  }
}
