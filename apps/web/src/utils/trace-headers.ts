import { context, propagation } from '@opentelemetry/api';

export function injectTraceHeaders(headers: Headers): Headers {
  if (typeof window !== 'undefined') {
    return headers;
  }

  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  for (const [key, value] of Object.entries(carrier)) {
    headers.set(key, value);
  }

  return headers;
}
