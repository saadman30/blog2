import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface CopyCodeButtonProps {
  code: string;
}

export function CopyCodeButton({ code }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()}>
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
