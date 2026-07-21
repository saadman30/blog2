import { ExecutionContext } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

describe('HttpMetricsInterceptor', () => {
  const durationHistogram = {
    observe: jest.fn(),
  } as unknown as Histogram<string>;
  const requestsCounter = {
    inc: jest.fn(),
  } as unknown as Counter<string>;
  const errorsCounter = {
    inc: jest.fn(),
  } as unknown as Counter<string>;

  const interceptor = new HttpMetricsInterceptor(
    durationHistogram,
    requestsCounter,
    errorsCounter,
  );

  const createContext = (request: Record<string, unknown>, statusCode = 200) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records success metrics using route path', (done) => {
    const context = createContext({
      method: 'GET',
      route: { path: '/posts/:slug' },
      path: '/posts/demo',
    });

    interceptor.intercept(context, { handle: () => of({ ok: true }) }).subscribe({
      next: () => {
        expect(durationHistogram.observe).toHaveBeenCalled();
        expect(requestsCounter.inc).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            route: '/posts/:slug',
            status_code: '200',
          }),
        );
        expect(errorsCounter.inc).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('falls back to request path when route is unavailable', (done) => {
    const context = createContext({
      method: 'POST',
      path: '/api/posts',
    });

    interceptor.intercept(context, { handle: () => of(null) }).subscribe({
      complete: () => {
        expect(requestsCounter.inc).toHaveBeenCalledWith(
          expect.objectContaining({ route: '/api/posts' }),
        );
        done();
      },
    });
  });

  it('records error metrics for thrown errors', (done) => {
    const context = createContext(
      {
        method: 'DELETE',
        path: '/api/posts/1',
      },
      200,
    );

    interceptor
      .intercept(context, {
        handle: () => throwError(() => ({ status: 404 })),
      })
      .subscribe({
        error: () => {
          expect(errorsCounter.inc).toHaveBeenCalledWith(
            expect.objectContaining({ status_code: '404' }),
          );
          done();
        },
      });
  });

  it('defaults to 500 when error status is missing', (done) => {
    const context = createContext({
      method: 'PATCH',
      path: '/api/posts/1',
    });

    interceptor
      .intercept(context, {
        handle: () => throwError(() => new Error('boom')),
      })
      .subscribe({
        error: () => {
          expect(errorsCounter.inc).toHaveBeenCalledWith(
            expect.objectContaining({ status_code: '500' }),
          );
          done();
        },
      });
  });

  it('records error metrics for 4xx responses', (done) => {
    const context = createContext(
      {
        method: 'GET',
        path: '/api/posts',
      },
      401,
    );

    interceptor.intercept(context, { handle: () => of(null) }).subscribe({
      complete: () => {
        expect(errorsCounter.inc).toHaveBeenCalledWith(
          expect.objectContaining({ status_code: '401' }),
        );
        done();
      },
    });
  });
});
