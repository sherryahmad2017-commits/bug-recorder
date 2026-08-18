'use client';

import { useRouter } from 'next/navigation';
import { useAppData } from '@/lib/app-data-context';

export function OrgSwitcher() {
  const { memberships, currentMembership } = useAppData();
  const router = useRouter();

  if (memberships.length <= 1) {
    return <span className="text-sm font-medium text-slate-700">{currentMembership?.organisation.name}</span>;
  }

  return (
    <div>
      <label htmlFor="org-switcher" className="sr-only">
        Switch organisation
      </label>
      <select
        id="org-switcher"
        className="focus-ring rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700"
        value={currentMembership?.organisation.slug ?? ''}
        onChange={(e) => router.push(`/${e.target.value}/projects`)}
      >
        {memberships.map((m) => (
          <option key={m.organisation.id} value={m.organisation.slug}>
            {m.organisation.name}
          </option>
        ))}
      </select>
    </div>
  );
}
