'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppDataProvider } from '@/lib/app-data-context';
import { OrgSwitcher } from '@/components/org/OrgSwitcher';
import { Spinner } from '@/components/ui/Spinner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && !user) {
      router.replace('/login');
    }
  }, [initializing, user, router]);

  if (initializing || !user) {
    return <Spinner label="Loading…" />;
  }

  return (
    <AppDataProvider>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <span className="relative flex h-6 w-6 items-center justify-center rounded-md bg-brand-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <span className="text-sm font-semibold text-slate-900">ReproFlow</span>
              </Link>
              <span className="text-slate-300">/</span>
              <OrgSwitcher />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{user.fullName}</span>
              <button
                onClick={() => logout().then(() => router.replace('/login'))}
                className="focus-ring rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </AppDataProvider>
  );
}
