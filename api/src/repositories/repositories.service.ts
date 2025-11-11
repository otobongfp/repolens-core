import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { S3Service } from '../common/s3/s3.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class RepositoriesService {
  // Core-only mode: Use system defaults for tenant
  private readonly SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly s3: S3Service
  ) {}

  async create(projectId: string, repoData: any) {
    // Ensure system tenant exists
    await this.ensureSystemTenant();

    const repo = await this.prisma.repository.create({
      data: {
        name: repoData.name || `repo-${Date.now()}`,
        url: repoData.url || repoData.github_url,
        path: repoData.path || repoData.local_path,
        branch: repoData.branch || 'main',
        projectId,
        tenantId: this.SYSTEM_TENANT_ID,
        status: 'PENDING',
      },
    });

    // Clone repository in background if URL provided
    if (repoData.url) {
      this.cloneRepository(repo, repoData.url, repoData.branch || 'main').catch((error) => {
        console.error('Failed to clone repository:', error);
      });
    }

    return repo;
  }

  private async cloneRepository(repo: any, url: string, branch: string) {
    try {
      // Update status to INDEXING
      await this.prisma.repository.update({
        where: { id: repo.id },
        data: { status: 'INDEXING' },
      });

      // Get project path
      const projectPath = this.storage.getProjectPath(repo.projectId);
      await this.storage.ensureProjectDirectory(repo.projectId);

      // Clone the repository using git command
      const repoPath = path.join(projectPath, repo.id);

      await execAsync(`git clone --branch ${branch} --depth 1 ${url} ${repoPath}`);

      // Get current commit SHA to track changes
      const { stdout: commitSha } = await execAsync(`git rev-parse HEAD`, { cwd: repoPath });
      const sha = commitSha.trim();

      // Parse owner/name from URL
      let owner = 'unknown';
      let name = path.basename(url).replace('.git', '');
      let fullName = `unknown/${name}`;
      const match = url.match(/(?:github\.com|gitlab\.com)[\/:]([^\/]+)\/([^\/\.]+)/);
      if (match) {
        owner = match[1];
        name = match[2].replace('.git', '');
        fullName = `${owner}/${name}`;
      }

      // Create or update Repo record (needed for FileBlob, Node, etc.)
      await this.prisma.repo.upsert({
        where: {
          id: repo.id,
        },
        create: {
          id: repo.id,
          provider: 'github',
          owner,
          name,
          fullName,
          url,
          defaultBranch: branch,
          latestSha: sha,
        },
        update: {
          latestSha: sha,
          url,
        },
      });

      // Upload to S3 for storage/backup
      const s3Key = await this.s3.uploadRepository(repo.id, repoPath);

      // Update status to INDEXED and set path
      await this.prisma.repository.update({
        where: { id: repo.id },
        data: {
          status: 'INDEXED',
          path: repoPath,
          lastCommitSha: sha,
          lastIndexed: new Date(),
          s3ArchiveUrl: s3Key,
        },
      });
    } catch (error) {
      // Update status to FAILED
      await this.prisma.repository.update({
        where: { id: repo.id },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async checkForUpdates(repoId: string): Promise<boolean> {
    const repo = await this.prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repo || !repo.url) {
      return false;
    }

    // Check latest commit from remote
    const { stdout: latestSha } = await execAsync(
      `git ls-remote ${repo.url} ${repo.branch || 'main'}`
    );
    const remoteSha = latestSha.split('\t')[0].trim();

    // Compare with stored SHA
    return remoteSha !== repo.lastCommitSha;
  }

  async findAll() {
    // Core mode: Return all repositories (no tenant filtering)
    return this.prisma.repository.findMany({
      include: { project: true },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const repo = await this.prisma.repository.findFirst({
      where: { id },
      include: { project: true, analyses: true },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    return repo;
  }

  async update(id: string, updateData: any) {
    return this.prisma.repository.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const repo = await this.findOne(id);

    // Delete from storage
    if (repo.path) {
      await this.storage.deleteProjectDirectory(id);
    }

    // Delete from database
    return this.prisma.repository.delete({ where: { id } });
  }

  async analyze(id: string) {
    return { message: 'Analysis started', repositoryId: id };
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
}
