import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  it('wraps response data', async () => {
    const interceptor = new TransformInterceptor<string>();
    const next: CallHandler<string> = {
      handle: () => of('payload'),
    };
    const result = await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, next),
    );
    expect(result).toEqual({ success: true, data: 'payload' });
  });
});
