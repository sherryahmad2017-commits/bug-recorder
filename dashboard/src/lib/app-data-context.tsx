'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import type { CurrentUser, Membership } from './types';

interface AppDataContextValue {
  loading: boolean;
  error: string | null;
  memberships: Membership[];
  /** The organisation matching the :org slug in the current route, once loaded. */
  currentMembership: Membership | null;
  refetch: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { apiFetch } = useAuth();
  const params = useParams<{ org?: string }>();
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<CurrentUser>('/me')
      .then((me) => {
        if (!cancelled) setMemberships(me.memberships);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your organisations.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch, reloadToken]);

  const currentMembership = useMemo(
    () => memberships.find((m) => m.organisation.slug === params.org) ?? null,
    [memberships, params.org],
  );

  useEffect(() => {
    if (!loading && !error && params.org && memberships.length > 0 && !currentMembership) {
      // The org slug in the URL doesn't match any membership — bounce to a
      // valid workspace rather than silently rendering nothing.
      router.replace(`/${memberships[0]!.organisation.slug}/projects`);
    }
  }, [loading, error, params.org, memberships, currentMembership, router]);

  const value: AppDataContextValue = {
    loading,
    error,
    memberships,
    currentMembership,
    refetch: () => setReloadToken((t) => t + 1),
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider.');
  return ctx;
}
