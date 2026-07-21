import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiFetch, getApiBaseUrl } from '@/utils/api-client';

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns default api base url', () => {
    expect(getApiBaseUrl()).toContain('/api');
  });

  it('returns data on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { ok: true } }),
      }),
    );
    await expect(apiFetch<{ ok: boolean }>('/health', { method: 'GET' }, 'token')).resolves.toEqual({
      ok: true,
    });
  });

  it('sets content-type for bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/x', { method: 'POST', body: '{}' });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('throws ApiClientError on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: ['bad', 'request'],
          statusCode: 400,
        }),
      }),
    );
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiClientError);
  });

  it('handles string error messages and empty payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          message: 'nope',
          statusCode: 500,
        }),
      }),
    );
    await expect(apiFetch('/x')).rejects.toMatchObject({ message: 'nope' });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('invalid json');
        },
      }),
    );
    await expect(apiFetch('/x')).rejects.toMatchObject({ message: 'Request failed' });
  });

  it('retries once after refreshing an expired access token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          message: 'Unauthorized',
          statusCode: 401,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { accessToken: 'new-token' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { ok: true } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { authStore, setAuth } = await import('@/stores/auth-store');
    setAuth({ id: 'u1', email: 'a@b.com', role: 'EDITOR' }, 'old-token');

    await expect(apiFetch<{ ok: boolean }>('/posts', { method: 'GET' }, 'old-token')).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(authStore.get().accessToken).toBe('new-token');
  });

  it('falls back to error when refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            message: 'Unauthorized',
            statusCode: 401,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            message: 'Invalid refresh token',
            statusCode: 401,
          }),
        }),
    );

    await expect(apiFetch('/posts', { method: 'GET' }, 'old-token')).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });

  it('handles refresh network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            message: 'Unauthorized',
            statusCode: 401,
          }),
        })
        .mockRejectedValueOnce(new Error('network down')),
    );

    await expect(apiFetch('/posts', { method: 'GET' }, 'old-token')).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });

  it('ignores malformed refresh payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            message: 'Unauthorized',
            statusCode: 401,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: {} }),
        }),
    );

    await expect(apiFetch('/posts', { method: 'GET' }, 'old-token')).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });

  it('ignores refresh responses with invalid json', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            message: 'Unauthorized',
            statusCode: 401,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('invalid json');
          },
        }),
    );

    await expect(apiFetch('/posts', { method: 'GET' }, 'old-token')).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });

  it('retries with refreshed token when auth store has no user', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            message: 'Unauthorized',
            statusCode: 401,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { accessToken: 'new-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { ok: true } }),
        }),
    );

    const { authStore } = await import('@/stores/auth-store');
    authStore.set({ user: null, accessToken: null });

    await expect(apiFetch<{ ok: boolean }>('/posts', { method: 'GET' }, 'old-token')).resolves.toEqual({
      ok: true,
    });
  });
});
