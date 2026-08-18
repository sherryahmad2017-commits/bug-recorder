import type { OrganisationRole } from './types';

// Mirrors backend/src/common/authz/org-role.util.ts — the server re-checks
// this independently on every write; this copy only drives what the UI shows.
const ROLE_RANK: Record<OrganisationRole, number> = {
  viewer: 0,
  reporter: 1,
  developer: 2,
  admin: 3,
  owner: 4,
};

export function hasMinRole(role: OrganisationRole | undefined, min: OrganisationRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
