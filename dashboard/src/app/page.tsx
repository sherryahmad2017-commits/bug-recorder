'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { Organisation } from '@/lib/types';

export default function RootPage() {
  const { user, initializing, apiFetch } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    apiFetch<Organisation[]>('/organisations')
      .then((orgs) => {
        if (cancelled) return;
        if (orgs.length > 0) {
          router.replace(`/${orgs[0]!.slug}/projects`);
        } else {
          setError('no-orgs');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your organisations.');
      });

    return () => {
      cancelled = true;
    };
  }, [initializing, user, apiFetch, router]);

  if (error === 'no-orgs') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-slate-600">
        You&apos;re not part of any organisation yet. Ask an admin to invite you, or sign up to create a new one.
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <ErrorBanner message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return <Spinner label="Loading your workspace…" />;
}
