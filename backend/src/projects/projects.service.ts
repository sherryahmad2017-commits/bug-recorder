import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { assertMinRole } from '../common/authz/org-role.util';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, organisationId: string) {
    // Any member (viewer+) can list; assertMinRole throws 403 if not a member at all.
    await assertMinRole(this.prisma, organisationId, userId, 'viewer');
    return this.prisma.project.findMany({
      where: { organisationId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateProjectDto) {
    await assertMinRole(this.prisma, dto.organisationId, userId, 'admin');

    const existingKey = await this.prisma.project.findUnique({
      where: { organisationId_key: { organisationId: dto.organisationId, key: dto.key } },
    });
    if (existingKey) {
      throw AppException.conflict(`A project with key "${dto.key}" already exists in this organisation.`);
    }

    return this.prisma.project.create({
      data: {
        organisationId: dto.organisationId,
        name: dto.name,
        key: dto.key,
        description: dto.description,
        createdById: userId,
      },
    });
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.findOrThrow(projectId);
    await assertMinRole(this.prisma, project.organisationId, userId, 'admin');

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        archivedAt: dto.archived === undefined ? undefined : dto.archived ? new Date() : null,
      },
    });
  }

  private async findOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw AppException.notFound('Project not found.');
    return project;
  }
}
