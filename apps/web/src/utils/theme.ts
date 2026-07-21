export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pcms-theme';

export function getLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

export function getMatchMedia(): ((query: string) => MediaQueryList) | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia.bind(window);
}

export function getDocumentRoot(): Element | null {
  if (typeof document === 'undefined') {
    return null;
  }
  return document.documentElement;
}

export function getStoredTheme(
  storage: Pick<Storage, 'getItem'> | null = getLocalStorage(),
): ThemeMode | null {
  if (!storage) {
    return null;
  }
  const value = storage.getItem(STORAGE_KEY);
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return null;
}

export function getPreferredTheme(
  matchMedia: ((query: string) => MediaQueryList) | null = getMatchMedia(),
): ThemeMode {
  if (!matchMedia) {
    return 'light';
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(
  storage: Pick<Storage, 'getItem'> | null = getLocalStorage(),
  matchMedia: ((query: string) => MediaQueryList) | null = getMatchMedia(),
): ThemeMode {
  return getStoredTheme(storage) ?? getPreferredTheme(matchMedia);
}

export function applyTheme(
  theme: ThemeMode,
  root: Element | null = getDocumentRoot(),
): void {
  if (!root) {
    return;
  }
  root.classList.toggle('dark', theme === 'dark');
}

export function setTheme(
  theme: ThemeMode,
  storage: Pick<Storage, 'setItem'> | null = getLocalStorage(),
  root: Element | null = getDocumentRoot(),
): void {
  if (storage) {
    storage.setItem(STORAGE_KEY, theme);
  }
  applyTheme(theme, root);
}

export function toggleTheme(
  current: ThemeMode,
  storage: Pick<Storage, 'setItem'> | null = getLocalStorage(),
  root: Element | null = getDocumentRoot(),
): ThemeMode {
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  setTheme(next, storage, root);
  return next;
}
