import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from '../shared/dto/projects.dto';
import { RepositoriesService } from '../repositories/repositories.service';
import { StorageService } from '../common/storage/storage.service';
import { S3Service } from '../common/s3/s3.service';
import * as fs from 'fs/promises';

@Injectable()
export class ProjectsService {
  // Core-only mode: Use system defaults for tenant/user
  private readonly SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
  private readonly SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repositoriesService: RepositoriesService,
    private readonly storage: StorageService,
    private readonly s3: S3Service
  ) {}

  async create(createDto: CreateProjectDto) {
    this.logger.log(`Creating project: ${createDto.name}`);

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

    this.logger.log(`Project created with ID: ${project.id}`);

    // If source_config is provided, create a repository automatically
    if (createDto.source_config) {
      const repoName = createDto.name.toLowerCase().replace(/\s+/g, '-');
      const repoData: any = {
        name: repoName,
        projectId: project.id,
      };

      if (createDto.source_config.type === 'local' && createDto.source_config.local_path) {
        repoData.path = createDto.source_config.local_path;
        this.logger.log(`Repository will use local path: ${repoData.path}`);
      } else if (
        (createDto.source_config.type === 'github' || createDto.source_config.type === 'url') &&
        (createDto.source_config.github_url || createDto.source_config.url)
      ) {
        repoData.url = createDto.source_config.github_url || createDto.source_config.url;
        repoData.branch = createDto.source_config.branch || 'main';
        this.logger.log(`Repository will clone from: ${repoData.url} (branch: ${repoData.branch})`);
      }

      // Use RepositoriesService to create repository (this will trigger clone/indexing if URL provided)
      this.repositoriesService
        .create(project.id, repoData)
        .then((repo) => {
          this.logger.log(`Repository created and cloning started for: ${repo.id}`);
        })
        .catch((error) => {
          this.logger.error(`Failed to create repository for project ${project.id}:`, error);
          this.logger.error(error.stack);
        });
    }

    return project;
  }

  async findAll() {
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
    this.logger.log(`Deleting project: ${id}`);

    // Get project with all repositories
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        repositories: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    try {
      // Delete all repository files and artifacts
      for (const repository of project.repositories) {
        this.logger.log(`Cleaning up repository: ${repository.id}`);

        if (repository.path) {
          try {
            // The repository path is already the full path, so we can delete it directly
            await fs.rm(repository.path, { recursive: true, force: true });
            this.logger.log(`Deleted local repository files: ${repository.path}`);
          } catch (error) {
            this.logger.warn(`Failed to delete local repository files ${repository.path}:`, error);
          }
        }

        // Delete S3 artifacts (repos, ASTs, files)
        try {
          await this.s3.deleteRepositoryArtifacts(repository.id);
          this.logger.log(`Deleted S3 artifacts for repository: ${repository.id}`);
        } catch (error) {
          this.logger.warn(`Failed to delete S3 artifacts for repository ${repository.id}:`, error);
        }

        try {
          await this.prisma.repo.deleteMany({
            where: { id: repository.id },
          });
          this.logger.log(`Deleted Repo record: ${repository.id}`);
        } catch (error) {
          this.logger.warn(`Failed to delete Repo record ${repository.id}:`, error);
        }
      }

      // Delete project directory from storage
      try {
        await this.storage.deleteProjectDirectory(id);
        this.logger.log(`Deleted project directory: ${id}`);
      } catch (error) {
        this.logger.warn(`Failed to delete project directory ${id}:`, error);
      }

      const deletedProject = await this.prisma.project.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted project: ${id}`);
      return deletedProject;
    } catch (error) {
      this.logger.error(`Failed to delete project ${id}:`, error);
      this.logger.error(error.stack);
      throw error;
    }
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
