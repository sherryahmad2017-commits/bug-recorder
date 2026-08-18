// Mirrors backend/prisma/schema.prisma (docs/ARCHITECTURE.md §6).

export type OrganisationRole = 'owner' | 'admin' | 'developer' | 'reporter' | 'viewer';
export type OrganisationPlan = 'free' | 'solo' | 'team' | 'agency' | 'enterprise';

export interface OrganisationSummary {
  id: string;
  name: string;
  slug: string;
  plan: OrganisationPlan;
}

export interface Membership {
  role: OrganisationRole;
  organisation: OrganisationSummary;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  memberships: Membership[];
}

export interface Project {
  id: string;
  organisationId: string;
  name: string;
  key: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
