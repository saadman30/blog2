import { propagation } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { injectTraceHeaders } from '@/utils/trace-headers';

describe('trace-headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns headers unchanged in browser environments', () => {
    vi.stubGlobal('window', {});
    const headers = new Headers({ 'X-Test': '1' });
    expect(injectTraceHeaders(headers)).toBe(headers);
    expect(headers.get('X-Test')).toBe('1');
  });

  it('injects active trace context in node environments', () => {
    vi.stubGlobal('window', undefined);
    const headers = new Headers();

    vi.spyOn(propagation, 'inject').mockImplementation((_ctx, carrier) => {
      Object.assign(carrier as Record<string, string>, {
        traceparent: '00-abc-def-01',
      });
    });

    injectTraceHeaders(headers);
    expect(headers.get('traceparent')).toBe('00-abc-def-01');
  });
});
