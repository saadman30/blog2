import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { applyTheme, resolveTheme, toggleTheme, type ThemeMode } from '@/utils/theme';

export function ThemeToggle() {
  const [theme, setLocalTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const resolved = resolveTheme();
    applyTheme(resolved);
    return resolved;
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Toggle color theme"
      onClick={() => setLocalTheme(toggleTheme(theme))}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
}
