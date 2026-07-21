import { authStore, setAuth } from '@/stores/auth-store';

export interface ApiErrorBody {
  success: false;
  message: string | string[];
  statusCode: number;
}

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly body: ApiErrorBody | null;

  constructor(message: string, statusCode: number, body: ApiErrorBody | null = null) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

export function getApiBaseUrl(): string {
  return import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001/api';
}

type ApiFetchInit = RequestInit & { _retried?: boolean };

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    const payload = (await response.json().catch(() => null)) as
      | { success: true; data: { accessToken: string } }
      | ApiErrorBody
      | null;
    if (
      !response.ok ||
      !payload ||
      payload.success === false ||
      !('data' in payload) ||
      !payload.data.accessToken
    ) {
      return null;
    }
    return payload.data.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: ApiFetchInit = {},
  accessToken?: string,
): Promise<T> {
  const { injectTraceHeaders } = await import('./trace-headers');
  const headers = injectTraceHeaders(new Headers(init.headers));
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  const payload = (await response.json().catch(() => null)) as
    | { success: true; data: T }
    | ApiErrorBody
    | null;

  if (response.status === 401 && !init._retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const state = authStore.get();
      if (state.user) {
        setAuth(state.user, refreshed);
      }
      return apiFetch<T>(path, { ...init, _retried: true }, refreshed);
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const message =
      payload && 'message' in payload
        ? Array.isArray(payload.message)
          ? payload.message.join(', ')
          : payload.message
        : 'Request failed';
    throw new ApiClientError(
      message,
      response.status,
      payload && payload.success === false ? payload : null,
    );
  }

  return payload.data;
}
