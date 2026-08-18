import { useEffect, useState } from 'react';
import { logout, restoreSession } from '../lib/api-client';
import type { CurrentUser } from '../lib/types';
import { Spinner } from './components/Spinner';
import { Login } from './routes/Login';
import { Signup } from './routes/Signup';
import { ProjectSelect } from './routes/ProjectSelect';

type Screen = { name: 'restoring' } | { name: 'login' } | { name: 'signup' } | { name: 'projects'; user: CurrentUser };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'restoring' });

  useEffect(() => {
    let cancelled = false;
    restoreSession().then((user) => {
      if (cancelled) return;
      setScreen(user ? { name: 'projects', user } : { name: 'login' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await logout();
    setScreen({ name: 'login' });
  }

  return (
    <>
      <header className="rf-header">
        <div className="rf-brand">
          <span className="rf-brand-mark" aria-hidden="true" />
          ReproFlow
        </div>
      </header>

      {screen.name === 'restoring' && <Spinner label="Loading…" />}
      {screen.name === 'login' && (
        <Login onLoggedIn={(user) => setScreen({ name: 'projects', user })} onSwitchToSignup={() => setScreen({ name: 'signup' })} />
      )}
      {screen.name === 'signup' && (
        <Signup onSignedUp={(user) => setScreen({ name: 'projects', user })} onSwitchToLogin={() => setScreen({ name: 'login' })} />
      )}
      {screen.name === 'projects' && <ProjectSelect user={screen.user} />}

      {screen.name === 'projects' && (
        <footer className="rf-footer">
          <span className="rf-user" title={screen.user.email}>
            {screen.user.fullName}
          </span>
          <button type="button" className="rf-button rf-button-secondary" onClick={handleLogout}>
            Log out
          </button>
        </footer>
      )}
    </>
  );
}
