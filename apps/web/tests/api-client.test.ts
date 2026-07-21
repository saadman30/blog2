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
});
