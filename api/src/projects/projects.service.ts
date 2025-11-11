import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from '../shared/dto/projects.dto';

@Injectable()
export class ProjectsService {
  // Core-only mode: Use system defaults for tenant/user
  private readonly SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
  private readonly SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateProjectDto) {
    // Ensure system tenant and user exist
    await this.ensureSystemTenant();
    await this.ensureSystemUser();

    const project = await this.prisma.project.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        ownerId: this.SYSTEM_USER_ID,
        tenantId: this.SYSTEM_TENANT_ID,
        status: 'ACTIVE',
      },
      include: {
        repositories: true,
      },
    });

    // If source_config is provided, create a repository automatically
    if (createDto.source_config) {
      const repoName = createDto.name.toLowerCase().replace(/\s+/g, '-');
      const repoData: any = {
        name: repoName,
        projectId: project.id,
      };

      if (createDto.source_config.type === 'local' && createDto.source_config.local_path) {
        repoData.path = createDto.source_config.local_path;
      } else if (
        (createDto.source_config.type === 'github' || createDto.source_config.type === 'url') &&
        (createDto.source_config.github_url || createDto.source_config.url)
      ) {
        repoData.url = createDto.source_config.github_url || createDto.source_config.url;
        repoData.branch = createDto.source_config.branch || 'main';
      }

      // Create repository in background (this will trigger clone/indexing if URL provided)
      this.createRepository(project.id, repoData).catch((error) => {
        console.error('Failed to create repository for project:', error);
      });
    }

    return project;
  }

  private async createRepository(projectId: string, repoData: any) {
    const repo = await this.prisma.repository.create({
      data: {
        name: repoData.name || `repo-${Date.now()}`,
        url: repoData.url,
        path: repoData.path,
        branch: repoData.branch || 'main',
        projectId,
        tenantId: this.SYSTEM_TENANT_ID,
        status: 'PENDING',
      },
    });
    return repo;
  }

  async findAll() {
    // In core mode, return all projects (no tenant filtering)
    const projects = await this.prisma.project.findMany({
      include: {
        repositories: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Return in format expected by frontend
    return {
      projects: projects.map((p) => ({
        project_id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        source_config: {
          type: p.repositories?.[0]?.path ? 'local' : p.repositories?.[0]?.url ? 'github' : 'local',
          local_path: p.repositories?.[0]?.path || null,
          github_url: p.repositories?.[0]?.url || null,
          branch: p.repositories?.[0]?.branch || 'main',
        },
        file_count: null,
        size_bytes: null,
        analysis_count: 0,
        created_at: p.createdAt.toISOString(),
        updated_at: p.updatedAt.toISOString(),
        last_analyzed: null,
      })),
      total: projects.length,
      page: 1,
      page_size: projects.length,
    };
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
      },
      include: {
        repositories: true,
        analyses: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(id: string, updateDto: UpdateProjectDto) {
    // Build update data, only including defined fields
    const updateData: any = {};
    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }
    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }
    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status;
    }

    return this.prisma.project.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return this.prisma.project.delete({
      where: { id },
    });
  }

  private async ensureSystemTenant() {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: this.SYSTEM_TENANT_ID },
    });

    if (!tenant) {
      await this.prisma.tenant.create({
        data: {
          id: this.SYSTEM_TENANT_ID,
          name: 'System (Core Mode)',
          slug: 'system-core',
        },
      });
    }
  }

  private async ensureSystemUser() {
    const user = await this.prisma.user.findUnique({
      where: { id: this.SYSTEM_USER_ID },
    });

    if (!user) {
      await this.prisma.user.create({
        data: {
          id: this.SYSTEM_USER_ID,
          email: 'system@repolens.local',
          fullName: 'System User',
          role: 'ADMIN',
          isVerified: true,
        },
      });
    }
  }
}
