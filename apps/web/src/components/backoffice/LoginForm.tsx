import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/utils/api-client';
import { setAuth, type AuthUser } from '@/stores/auth-store';

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuth(result.user, result.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <Input
        type="email"
        name="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <Input
        type="password"
        name="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
      />
      {error ? <p role="alert">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
