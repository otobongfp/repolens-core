import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from '../shared/dto/projects.dto';
import { RepositoriesService } from '../repositories/repositories.service';
import { StorageService } from '../common/storage/storage.service';
import { S3Service } from '../common/s3/s3.service';
import * as fs from 'fs/promises';

@Injectable()
export class ProjectsService {
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
        analyses: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate progress for each project (more efficiently for the list)
    const projectList = await Promise.all(
      projects.map(async (p) => {
        let progress = null;
        let currentStep = null;
        let fileCount = 0;
        let nodeCount = 0;
        let embeddingCount = 0;

        // Derive status from repositories
        const repoStatuses = p.repositories.map(r => r.status);
        let derivedStatus: any = 'ready';
        
        if (repoStatuses.some(s => s === 'INDEXING')) {
          derivedStatus = 'analyzing';
        } else if (repoStatuses.every(s => s === 'INDEXED') && repoStatuses.length > 0) {
          derivedStatus = 'completed';
        } else if (repoStatuses.some(s => s === 'FAILED')) {
          derivedStatus = 'error';
        }

        if (derivedStatus === 'analyzing' || derivedStatus === 'completed') {
          const repoIds = p.repositories.map((r) => r.id);
          const [files, nodes, embeddings] = await this.prisma.withRetry(() =>
            Promise.all([
              this.prisma.fileBlob.count({ where: { repoId: { in: repoIds } } }),
              this.prisma.node.count({ where: { repoId: { in: repoIds } } }),
              this.prisma.embedding.count({ where: { repoId: { in: repoIds } } }),
            ])
          );
          
          fileCount = files;
          nodeCount = nodes;
          embeddingCount = embeddings;

          // Refine status based on actual data: if nodes exist but embeddings aren't done, it's still 'analyzing'
          if (nodes > 0 && embeddings < nodes) {
            derivedStatus = 'analyzing';
          }

          if (derivedStatus === 'analyzing') {
            const fileProgress = files > 0 ? (nodes > 0 ? 100 : 0) : 0; 
            const embeddingProgress = nodes > 0 ? (embeddings / nodes) * 100 : 0;
            
            progress = Math.round((fileProgress + embeddingProgress) / 2);
            currentStep = embeddingProgress < 100 ? 'embedding' : 'parsing';
          } else {
            progress = 100;
            currentStep = 'completed';
          }
        }

        return {
          project_id: p.id,
          name: p.name,
          description: p.description,
          status: derivedStatus,
          progress_percentage: progress,
          current_step: currentStep,
          source_config: {
            type: p.repositories?.[0]?.path ? 'local' : p.repositories?.[0]?.url ? 'github' : 'local',
            local_path: p.repositories?.[0]?.path || null,
            github_url: p.repositories?.[0]?.url || null,
            branch: p.repositories?.[0]?.branch || 'main',
          },
          file_count: fileCount,
          node_count: nodeCount,
          embedding_count: embeddingCount,
          analysis_count: p.analyses?.length || 0,
          created_at: p.createdAt.toISOString(),
          updated_at: p.updatedAt.toISOString(),
          last_analyzed: p.analyses?.[0]?.createdAt.toISOString() || null,
        };
      })
    );

    return {
      projects: projectList,
      total: projects.length,
      page: 1,
      page_size: projects.length,
    };
  }

  async findOne(id: string) {
    const p = await this.prisma.withRetry(() =>
      this.prisma.project.findFirst({
        where: {
          id,
        },
        include: {
          repositories: true,
          analyses: true,
        },
      })
    );

    if (!p) {
      throw new NotFoundException('Project not found');
    }

    // Map to frontend format
    return {
      project_id: p.id,
      name: p.name,
      description: p.description,
      status: p.repositories.some(r => r.status === 'INDEXING') ? 'analyzing' : 
              (p.repositories.every(r => r.status === 'INDEXED') && p.repositories.length > 0 ? 'completed' : 
              (p.repositories.some(r => r.status === 'FAILED') ? 'error' : 'ready')),
      source_config: {
        type: p.repositories?.[0]?.path ? 'local' : p.repositories?.[0]?.url ? 'github' : 'local',
        local_path: p.repositories?.[0]?.path || null,
        github_url: p.repositories?.[0]?.url || null,
        branch: p.repositories?.[0]?.branch || 'main',
      },
      file_count: p.repositories.reduce((acc, r) => acc + (r as any).file_count || 0, 0),
      analysis_count: p.analyses?.length || 0,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
      last_analyzed: p.analyses?.[0]?.createdAt.toISOString() || null,
    };
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

  async analyze(id: string) {
    this.logger.log(`Starting analysis for project: ${id}`);

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        repositories: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.repositories || project.repositories.length === 0) {
      throw new Error('Project has no repositories to analyze');
    }

    const analysisId = `analysis_${id}_${Date.now()}`;
    const startedAt = new Date().toISOString();

    const results = [];
    for (const repository of project.repositories) {
      try {
        this.logger.log(`Analyzing repository ${repository.id} for project ${id}`);
        const result = await this.repositoriesService.analyze(repository.id);
        results.push({
          repositoryId: repository.id,
          repositoryName: repository.name,
          ...result,
        });
      } catch (error) {
        this.logger.error(`Failed to analyze repository ${repository.id}:`, error);
        results.push({
          repositoryId: repository.id,
          repositoryName: repository.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      analysis_id: analysisId,
      project_id: id,
      status: 'started',
      started_at: startedAt,
      progress: {
        total: project.repositories.length,
        completed: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
        results,
      },
    };
  }

  async getAnalysisProgress(projectId: string, analysisId: string) {
    const project = await this.prisma.withRetry(() =>
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          repositories: true,
        },
      })
    );

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    let totalFiles = 0;
    let parsedFiles = 0;
    let totalNodes = 0;
    let embeddedNodes = 0;
    let completedRepos = 0;
    let indexingRepos = 0;

    for (const repository of project.repositories) {
      const repoId = repository.id;

      const [fileCount, nodeCount, embeddingCount] = await this.prisma.withRetry(() =>
        Promise.all([
          this.prisma.fileBlob.count({ where: { repoId } }),
          this.prisma.node.count({ where: { repoId } }),
          this.prisma.embedding.count({ where: { repoId } }),
        ])
      );

      totalFiles += fileCount;
      parsedFiles += nodeCount > 0 ? fileCount : 0;
      totalNodes += nodeCount;
      embeddedNodes += embeddingCount;

      if (repository.status === 'INDEXED') {
        completedRepos++;
      } else if (repository.status === 'INDEXING') {
        indexingRepos++;
      }
    }

    const repoProgress =
      project.repositories.length > 0 ? (completedRepos / project.repositories.length) * 100 : 0;

    const fileProgress = totalFiles > 0 ? (parsedFiles / totalFiles) * 100 : 0;
    const embeddingProgress = totalNodes > 0 ? (embeddedNodes / totalNodes) * 100 : 0;

    const overallProgress = Math.min(100, (repoProgress + fileProgress + embeddingProgress) / 3);

    let status = 'completed';
    let currentStep = 'completed';

    if (indexingRepos > 0) {
      status = 'in_progress';
      if (embeddingProgress < 100) {
        currentStep = 'embedding';
      } else if (fileProgress < 100) {
        currentStep = 'parsing';
      } else {
        currentStep = 'discovery';
      }
    } else if (completedRepos < project.repositories.length) {
      status = 'pending';
      currentStep = 'pending';
    }

    return {
      analysis_id: analysisId,
      project_id: projectId,
      status,
      progress_percentage: Math.round(overallProgress),
      current_step: currentStep,
      total_files: totalFiles,
      parsed_files: parsedFiles,
      total_nodes: totalNodes,
      embedded_nodes: embeddedNodes,
      repositories: {
        total: project.repositories.length,
        completed: completedRepos,
        indexing: indexingRepos,
      },
    };
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
