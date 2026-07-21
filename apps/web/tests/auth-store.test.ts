import { afterEach, describe, expect, it } from 'vitest';
import {
  authStore,
  clearAuth,
  hydrateAuth,
  isAuthenticated,
  setAuth,
} from '@/stores/auth-store';

describe('auth-store', () => {
  afterEach(() => {
    clearAuth();
    window.sessionStorage.clear();
  });

  it('sets and clears auth', () => {
    setAuth({ id: '1', email: 'a@b.com', role: 'ADMIN' }, 'token');
    expect(isAuthenticated()).toBe(true);
    expect(authStore.get().accessToken).toBe('token');
    clearAuth();
    expect(isAuthenticated()).toBe(false);
  });

  it('supports null session backends', () => {
    setAuth({ id: '1', email: 'a@b.com', role: 'ADMIN' }, 'token', null);
    expect(authStore.get().accessToken).toBe('token');
    clearAuth(null);
    expect(authStore.get().accessToken).toBeNull();
    expect(hydrateAuth(null).user).toBeNull();
  });

  it('hydrates from session storage', () => {
    window.sessionStorage.setItem('pcms-access-token', 't');
    window.sessionStorage.setItem(
      'pcms-user',
      JSON.stringify({ id: '1', email: 'a@b.com', role: 'EDITOR' }),
    );
    expect(hydrateAuth().user?.email).toBe('a@b.com');
  });

  it('clears on missing or invalid storage', () => {
    expect(hydrateAuth().user).toBeNull();
    window.sessionStorage.setItem('pcms-access-token', 't');
    window.sessionStorage.setItem('pcms-user', '{bad');
    expect(hydrateAuth().user).toBeNull();
  });
});
