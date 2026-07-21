import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthHydrate } from '@/components/backoffice/AuthHydrate';
import * as authStore from '@/stores/auth-store';

describe('AuthHydrate', () => {
  it('hydrates auth state on mount', () => {
    const hydrateAuth = vi.spyOn(authStore, 'hydrateAuth');
    render(<AuthHydrate />);
    expect(hydrateAuth).toHaveBeenCalledTimes(1);
  });
});
