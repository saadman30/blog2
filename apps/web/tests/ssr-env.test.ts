/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  getDocumentRoot,
  getLocalStorage,
  getMatchMedia,
  getPreferredTheme,
  getStoredTheme,
  resolveTheme,
  setTheme,
  toggleTheme,
} from '@/utils/theme';
import { getSessionStorage, hydrateAuth } from '@/stores/auth-store';

describe('ssr environment helpers', () => {
  it('returns null browser APIs in node', () => {
    expect(getLocalStorage()).toBeNull();
    expect(getMatchMedia()).toBeNull();
    expect(getDocumentRoot()).toBeNull();
    expect(getSessionStorage()).toBeNull();
    expect(getStoredTheme()).toBeNull();
    expect(getPreferredTheme()).toBe('light');
    expect(resolveTheme()).toBe('light');
    applyTheme('dark');
    setTheme('light');
    expect(toggleTheme('light')).toBe('dark');
    expect(hydrateAuth().accessToken).toBeNull();
  });
});
