import { IsIn } from 'class-validator';
import type { OrganisationRole } from '@prisma/client';

const ASSIGNABLE_ROLES: OrganisationRole[] = ['admin', 'developer', 'reporter', 'viewer'];

export class UpdateMemberRoleDto {
  @IsIn(ASSIGNABLE_ROLES)
  role!: Exclude<OrganisationRole, 'owner'>;
}
