// Mirrors the Prisma models in backend/prisma/schema.prisma (docs/ARCHITECTURE.md §6).

export type OrganisationRole = 'owner' | 'admin' | 'developer' | 'reporter' | 'viewer';
export type OrganisationPlan = 'free' | 'solo' | 'team' | 'agency' | 'enterprise';

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  plan: OrganisationPlan;
  ownerId: string;
  retentionDays: number;
  aiEnabled: boolean;
  analyticsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organisationId: string;
  name: string;
  key: string;
  description: string | null;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  role: OrganisationRole;
  organisation: Pick<Organisation, 'id' | 'name' | 'slug' | 'plan'>;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  memberships: Membership[];
}
