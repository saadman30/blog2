import { useEffect } from 'react';
import { hydrateAuth } from '@/stores/auth-store';

export function AuthHydrate() {
  useEffect(() => {
    hydrateAuth();
  }, []);
  return null;
}
