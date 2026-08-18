import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganisationRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../exceptions/app.exception';
import { MIN_ORG_ROLE_KEY } from '../decorators/org-roles.decorator';
import { ROLE_RANK } from '../authz/org-role.util';
import type { AuthenticatedUser } from '../../auth/jwt-payload.type';

// Every write path re-checks the caller's role against the DB — the JWT
// carries no role claims (docs/ARCHITECTURE.md §10). Routes protected by this
// guard must expose the target organisation as :organisationId in the path.
@Injectable()
export class OrgRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const minRole = this.reflector.getAllAndOverride<OrganisationRole | undefined>(MIN_ORG_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!minRole) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw AppException.unauthenticated();

    const organisationId: string | undefined = request.params?.organisationId;
    if (!organisationId) {
      throw new Error('OrgRoleGuard requires a :organisationId route param.');
    }

    const membership = await this.prisma.organisationMember.findUnique({
      where: { organisationId_userId: { organisationId, userId: user.id } },
    });

    if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw AppException.forbidden();
    }

    request.orgMembership = membership;
    return true;
  }
}
