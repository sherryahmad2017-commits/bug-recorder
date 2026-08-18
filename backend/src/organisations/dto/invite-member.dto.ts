import { IsEmail, IsIn } from 'class-validator';
import type { OrganisationRole } from '@prisma/client';

const INVITABLE_ROLES: OrganisationRole[] = ['admin', 'developer', 'reporter', 'viewer'];

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  // Owner is never assignable via invite — ownership transfers separately.
  @IsIn(INVITABLE_ROLES)
  role!: Exclude<OrganisationRole, 'owner'>;
}
