import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/utils/api-client';
import { authStore } from '@/stores/auth-store';

export function WriteForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'SCHEDULED' | 'PUBLISHED'>('DRAFT');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = authStore.get().accessToken;
    if (!token) {
      setMessage('Authentication required');
      return;
    }
    try {
      await apiFetch(
        '/posts',
        {
          method: 'POST',
          body: JSON.stringify({
            title,
            content,
            status,
            scheduledAt: scheduledAt || undefined,
          }),
        },
        token,
      );
      setMessage('Draft saved');
      setTitle('');
      setContent('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <Input
        placeholder="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <textarea
        className="min-h-48 w-full rounded-md border border-input bg-background p-3 text-sm"
        placeholder="Markdown content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        required
      />
      <label className="block text-sm">
        Status
        <select
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED')
          }
        >
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </label>
      <Input
        type="datetime-local"
        value={scheduledAt}
        onChange={(event) => setScheduledAt(event.target.value)}
        aria-label="Schedule publish time"
      />
      <Button type="submit">Save</Button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
