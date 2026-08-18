import { useState, type FormEvent } from 'react';
import { signup } from '../../lib/api-client';
import { ApiError } from '../../lib/api-error';
import type { CurrentUser } from '../../lib/types';
import { ErrorMessage } from '../components/ErrorMessage';

export function Signup({ onSignedUp, onSwitchToLogin }: { onSignedUp: (user: CurrentUser) => void; onSwitchToLogin: () => void }) {
  const [fullName, setFullName] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await signup({ email, password, fullName, organisationName });
      onSignedUp(user as CurrentUser);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rf-main">
      <div>
        <h1 className="rf-title">Create your account</h1>
        <p className="rf-subtitle">Sets up your organisation too — invite your team from the dashboard later.</p>
      </div>

      <form className="rf-form" onSubmit={handleSubmit} noValidate>
        {error && <ErrorMessage message={error} />}
        <div className="rf-field">
          <label className="rf-label" htmlFor="signup-name">
            Full name
          </label>
          <input
            id="signup-name"
            className="rf-input"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="rf-field">
          <label className="rf-label" htmlFor="signup-org">
            Organisation name
          </label>
          <input
            id="signup-org"
            className="rf-input"
            required
            placeholder="Your agency or client name"
            value={organisationName}
            onChange={(e) => setOrganisationName(e.target.value)}
          />
        </div>
        <div className="rf-field">
          <label className="rf-label" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            className="rf-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="rf-field">
          <label className="rf-label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            className="rf-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="rf-hint">At least 10 characters, with uppercase, lowercase, and a number.</span>
        </div>
        <button type="submit" className="rf-button" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="rf-link-row">
        Already have an account?{' '}
        <button type="button" className="rf-link" onClick={onSwitchToLogin}>
          Log in
        </button>
      </div>
    </div>
  );
}
