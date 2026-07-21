import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  buildThemeBootScript,
  getDocumentRoot,
  getLocalStorage,
  getMatchMedia,
  getPreferredTheme,
  getStoredTheme,
  resolveTheme,
  setTheme,
  THEME_STORAGE_KEY,
  toggleTheme,
} from '@/utils/theme';

describe('theme utils', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('exposes browser helpers in jsdom', () => {
    expect(getLocalStorage()).toBe(window.localStorage);
    expect(getDocumentRoot()).toBe(document.documentElement);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    expect(getMatchMedia()).toBeTypeOf('function');
  });

  it('reads stored theme', () => {
    expect(getStoredTheme(null)).toBeNull();
    expect(getStoredTheme()).toBeNull();
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getStoredTheme()).toBe('dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'nope');
    expect(getStoredTheme()).toBeNull();
  });

  it('prefers color scheme', () => {
    expect(getPreferredTheme(null)).toBe('light');
    const darkMq = {
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    const lightMq = { ...darkMq, matches: false };
    expect(getPreferredTheme(() => darkMq as MediaQueryList)).toBe('dark');
    expect(getPreferredTheme(() => lightMq as MediaQueryList)).toBe('light');
  });

  it('resolves, applies, sets, and toggles theme', () => {
    expect(resolveTheme(null, null)).toBe('light');
    applyTheme('dark', null);
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    setTheme('light', null, null);
    setTheme('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(toggleTheme('light')).toBe('dark');
    expect(toggleTheme('dark', null, null)).toBe('light');
  });

  it('builds inline theme boot script', () => {
    expect(buildThemeBootScript()).toContain(THEME_STORAGE_KEY);
    expect(buildThemeBootScript()).toContain('prefers-color-scheme');
  });
});
