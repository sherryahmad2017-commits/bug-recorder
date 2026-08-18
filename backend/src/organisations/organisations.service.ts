import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import type { CreateOrganisationDto } from './dto/create-organisation.dto';
import type { UpdateOrganisationDto } from './dto/update-organisation.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class OrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    return this.prisma.organisation.findMany({
      where: { deletedAt: null, members: { some: { userId } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateOrganisationDto) {
    const slug = await this.uniqueSlug(dto.name);
    return this.prisma.$transaction(async (tx) => {
      const organisation = await tx.organisation.create({
        data: { name: dto.name, slug, ownerId: userId },
      });
      await tx.organisationMember.create({
        data: { organisationId: organisation.id, userId, role: 'owner', invitedById: userId, joinedAt: new Date() },
      });
      return organisation;
    });
  }

  async update(organisationId: string, dto: UpdateOrganisationDto) {
    await this.assertExists(organisationId);
    return this.prisma.organisation.update({ where: { id: organisationId }, data: dto });
  }

  /**
   * Soft-deletes the organisation. Per docs/ARCHITECTURE.md §20/§28, the
   * scheduled hard-purge job (respecting retention_days) and the audit trail
   * for this action ship in Phase 4 alongside the rest of the deletion flows.
   */
  async softDelete(organisationId: string, requesterId: string) {
    const organisation = await this.assertExists(organisationId);
    if (organisation.ownerId !== requesterId) {
      throw AppException.forbidden('Only the organisation owner can delete it.');
    }
    await this.prisma.organisation.update({ where: { id: organisationId }, data: { deletedAt: new Date() } });
  }

  async inviteMember(organisationId: string, dto: InviteMemberDto) {
    const invitee = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!invitee) {
      // Phase 1 scope: invites attach an existing account. Emailed
      // invite-to-signup links are tracked for a later phase.
      throw AppException.notFound(
        `No ReproFlow account exists for ${dto.email}. They need to sign up before you can add them to this organisation.`,
      );
    }

    const existingMembership = await this.prisma.organisationMember.findUnique({
      where: { organisationId_userId: { organisationId, userId: invitee.id } },
    });
    if (existingMembership) {
      throw AppException.conflict('This user is already a member of the organisation.');
    }

    return this.prisma.organisationMember.create({
      data: { organisationId, userId: invitee.id, role: dto.role },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async updateMemberRole(organisationId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    const membership = await this.prisma.organisationMember.findUnique({
      where: { organisationId_userId: { organisationId, userId: targetUserId } },
    });
    if (!membership) throw AppException.notFound('Member not found.');
    if (membership.role === 'owner') {
      throw AppException.forbidden("The organisation owner's role can't be changed here.");
    }
    return this.prisma.organisationMember.update({
      where: { organisationId_userId: { organisationId, userId: targetUserId } },
      data: { role: dto.role },
    });
  }

  async removeMember(organisationId: string, targetUserId: string) {
    const membership = await this.prisma.organisationMember.findUnique({
      where: { organisationId_userId: { organisationId, userId: targetUserId } },
    });
    if (!membership) throw AppException.notFound('Member not found.');
    if (membership.role === 'owner') {
      throw AppException.forbidden('The organisation owner cannot be removed.');
    }
    await this.prisma.organisationMember.delete({
      where: { organisationId_userId: { organisationId, userId: targetUserId } },
    });
  }

  private async assertExists(organisationId: string) {
    const organisation = await this.prisma.organisation.findFirst({
      where: { id: organisationId, deletedAt: null },
    });
    if (!organisation) throw AppException.notFound('Organisation not found.');
    return organisation;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60) || 'organisation';

    let candidate = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.prisma.organisation.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
      candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
