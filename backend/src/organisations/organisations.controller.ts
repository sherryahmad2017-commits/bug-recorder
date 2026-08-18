import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrganisationsService } from './organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../common/guards/org-role.guard';
import { MinOrgRole } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.type';

@Controller('organisations')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class OrganisationsController {
  constructor(private readonly organisations: OrganisationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.organisations.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganisationDto) {
    return this.organisations.create(user.id, dto);
  }

  @Patch(':organisationId')
  @MinOrgRole('admin')
  update(@Param('organisationId') organisationId: string, @Body() dto: UpdateOrganisationDto) {
    return this.organisations.update(organisationId, dto);
  }

  @Delete(':organisationId')
  @MinOrgRole('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('organisationId') organisationId: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.organisations.softDelete(organisationId, user.id);
  }

  @Post(':organisationId/invites')
  @MinOrgRole('admin')
  invite(@Param('organisationId') organisationId: string, @Body() dto: InviteMemberDto) {
    return this.organisations.inviteMember(organisationId, dto);
  }

  @Patch(':organisationId/members/:userId')
  @MinOrgRole('admin')
  updateMemberRole(
    @Param('organisationId') organisationId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organisations.updateMemberRole(organisationId, userId, dto);
  }

  @Delete(':organisationId/members/:userId')
  @MinOrgRole('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(@Param('organisationId') organisationId: string, @Param('userId') userId: string): Promise<void> {
    await this.organisations.removeMember(organisationId, userId);
  }
}
