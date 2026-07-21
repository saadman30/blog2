import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/api-client';

interface ClapButtonProps {
  postId: string;
  initialClaps?: number;
}

export function ClapButton({ postId, initialClaps = 0 }: ClapButtonProps) {
  const [claps, setClaps] = useState(initialClaps);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setClaps(initialClaps);
  }, [initialClaps]);

  async function handleClap() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      const result = await apiFetch<{ claps: number }>(`/analytics/${postId}/clap`, {
        method: 'POST',
        body: JSON.stringify({ count: 1 }),
      });
      setClaps(result.claps);
    } catch {
      // Keep the last known count when the API is unavailable.
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={() => void handleClap()} disabled={pending}>
      Clap · {claps}
    </Button>
  );
}
