'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, parseErrorResponse } from './api-error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  locale: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  /** true only while the initial silent-refresh-on-load check is in flight. */
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { email: string; password: string; fullName: string; organisationName: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Authenticated fetch against the ReproFlow API — retries once after a silent refresh on 401. */
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  const silentRefresh = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) {
      accessTokenRef.current = null;
      return false;
    }
    const data = (await res.json()) as { accessToken: string };
    accessTokenRef.current = data.accessToken;
    return true;
  }, []);

  const rawApiFetch = useCallback(async <T,>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}),
        ...init.headers,
      },
    });

    if (res.status === 401 && !isRetry) {
      const refreshed = await silentRefresh();
      if (refreshed) return rawApiFetch<T>(path, init, true);
    }

    if (!res.ok) throw await parseErrorResponse(res);
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }, [silentRefresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await silentRefresh();
      if (cancelled) return;
      if (ok) {
        try {
          const me = await rawApiFetch<{ id: string; email: string; fullName: string; locale: string }>('/me');
          if (!cancelled) setUser(me);
        } catch {
          if (!cancelled) setUser(null);
        }
      }
      if (!cancelled) setInitializing(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw await parseErrorResponse(res);
    const data = (await res.json()) as { accessToken: string; user: SessionUser };
    accessTokenRef.current = data.accessToken;
    setUser(data.user);
  }, []);

  const signup = useCallback(
    async (input: { email: string; password: string; fullName: string; organisationName: string }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await parseErrorResponse(res);
      const data = (await res.json()) as { accessToken: string; user: SessionUser };
      accessTokenRef.current = data.accessToken;
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    accessTokenRef.current = null;
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, login, signup, logout, apiFetch: rawApiFetch }),
    [user, initializing, login, signup, logout, rawApiFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}

export { ApiError };
