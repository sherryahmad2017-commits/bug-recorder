import { SetMetadata } from '@nestjs/common';
import type { OrganisationRole } from '@prisma/client';

export const MIN_ORG_ROLE_KEY = 'minOrgRole';

// Marks a route as requiring at least the given organisation role.
// Roles rank owner > admin > developer > reporter > viewer (see OrgRoleGuard).
export const MinOrgRole = (role: OrganisationRole) => SetMetadata(MIN_ORG_ROLE_KEY, role);
