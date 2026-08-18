import { useState, type FormEvent } from 'react';
import { login } from '../../lib/api-client';
import { ApiError } from '../../lib/api-error';
import type { CurrentUser } from '../../lib/types';
import { ErrorMessage } from '../components/ErrorMessage';

export function Login({ onLoggedIn, onSwitchToSignup }: { onLoggedIn: (user: CurrentUser) => void; onSwitchToSignup: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(email, password);
      onLoggedIn(user as CurrentUser);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rf-main">
      <div>
        <h1 className="rf-title">Log in</h1>
        <p className="rf-subtitle">Sign in to start reporting bugs from this browser.</p>
      </div>

      <form className="rf-form" onSubmit={handleSubmit} noValidate>
        {error && <ErrorMessage message={error} />}
        <div className="rf-field">
          <label className="rf-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="rf-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="rf-field">
          <label className="rf-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="rf-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="rf-button" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <div className="rf-link-row">
        No account yet?{' '}
        <button type="button" className="rf-link" onClick={onSwitchToSignup}>
          Sign up
        </button>
      </div>
    </div>
  );
}
