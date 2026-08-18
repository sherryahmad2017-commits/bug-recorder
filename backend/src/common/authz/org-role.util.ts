import type { OrganisationRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../exceptions/app.exception';

export const ROLE_RANK: Record<OrganisationRole, number> = {
  viewer: 0,
  reporter: 1,
  developer: 2,
  admin: 3,
  owner: 4,
};

/**
 * For routes whose organisation isn't available as a :organisationId path
 * param (e.g. project- or report-scoped routes addressed by their own id),
 * services resolve the owning organisation first and call this directly —
 * same rank table and same "re-check on every request" rule as OrgRoleGuard.
 */
export async function assertMinRole(
  prisma: PrismaService,
  organisationId: string,
  userId: string,
  minRole: OrganisationRole,
) {
  const membership = await prisma.organisationMember.findUnique({
    where: { organisationId_userId: { organisationId, userId } },
  });
  if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw AppException.forbidden();
  }
  return membership;
}
