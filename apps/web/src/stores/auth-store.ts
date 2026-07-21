import { atom } from 'nanostores';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR';
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
}

export const authStore = atom<AuthState>({
  accessToken: null,
  user: null,
});

type SessionLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function getSessionStorage(): SessionLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage;
}

export function setAuth(
  user: AuthUser,
  accessToken: string,
  session: SessionLike | null = getSessionStorage(),
): void {
  authStore.set({ user, accessToken });
  if (session) {
    session.setItem('pcms-access-token', accessToken);
    session.setItem('pcms-user', JSON.stringify(user));
  }
}

export function clearAuth(session: SessionLike | null = getSessionStorage()): void {
  authStore.set({ user: null, accessToken: null });
  if (session) {
    session.removeItem('pcms-access-token');
    session.removeItem('pcms-user');
  }
}

export function hydrateAuth(
  session: SessionLike | null = getSessionStorage(),
): AuthState {
  if (!session) {
    return authStore.get();
  }
  const accessToken = session.getItem('pcms-access-token');
  const rawUser = session.getItem('pcms-user');
  if (!accessToken || !rawUser) {
    clearAuth(session);
    return authStore.get();
  }
  try {
    const user = JSON.parse(rawUser) as AuthUser;
    authStore.set({ accessToken, user });
  } catch {
    clearAuth(session);
  }
  return authStore.get();
}

export function isAuthenticated(): boolean {
  const state = authStore.get();
  return Boolean(state.accessToken && state.user);
}
