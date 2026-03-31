import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { S3Service } from '../common/s3/s3.service';
import { QueueService } from '../common/queue/queue.service';
import { ParserConfigService } from '../common/parser/parser-config.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

@Injectable()
export class RepositoriesService {
  private readonly SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
  private readonly SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
  private readonly logger = new Logger(RepositoriesService.name);
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly s3: S3Service,
    private readonly queue: QueueService,
    private readonly parserConfig: ParserConfigService
  ) {}

  async create(projectId: string, repoData: any) {
    this.logger.log(`Creating repository for project ${projectId}: ${repoData.name || 'unnamed'}`);

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

    this.logger.log(`Repository created with ID: ${repo.id}, URL: ${repo.url || 'N/A'}`);

    // Clone repository in background if URL provided
    if (repo.url) {
      this.logger.log(`Starting clone process for repository ${repo.id} from ${repo.url}`);
      this.cloneRepository(repo, repo.url, repo.branch || 'main').catch((error) => {
        this.logger.error(`Failed to clone repository ${repo.id}:`, error);
        this.logger.error(error.stack);
      });
    } else {
      this.logger.warn(`Repository ${repo.id} has no URL - skipping clone`);
    }

    return repo;
  }

  async analyzeDirect(url?: string, projectName?: string, localPath?: string) {
    this.logger.log(`Direct analysis requested for URL: ${url || 'N/A'}, LocalPath: ${localPath || 'N/A'}`);

    // 1. Ensure project exists or create a default one
    await this.ensureSystemTenant();
    
    let targetProjectId: string;
    const defaultProject = await this.prisma.project.findFirst({
      where: { name: 'Default Project' },
    });
    
    if (defaultProject) {
      targetProjectId = defaultProject.id;
    } else {
      const newProject = await this.prisma.project.create({
        data: {
          name: 'Default Project',
          description: 'Automatically created for quick analysis',
          tenantId: this.SYSTEM_TENANT_ID,
          ownerId: this.SYSTEM_USER_ID,
          status: 'ACTIVE',
        },
      });
      targetProjectId = newProject.id;
    }

    const name = projectName || (url ? path.basename(url) : (localPath ? path.basename(localPath) : 'quick-repo'));
    
    // 2. Create repository record
    const repo = await this.create(targetProjectId, {
      url: url || undefined,
      path: localPath || undefined,
      name: name,
    });

    // 3. For local folders, setup Repo record and analyze
    if (localPath) {
      await this.prisma.repo.upsert({
        where: { id: repo.id },
        create: {
          id: repo.id,
          provider: 'local',
          owner: 'local',
          name: path.basename(localPath),
          fullName: `local/${path.basename(localPath)}`,
          url: '',
          latestSha: 'local',
        },
        update: {},
      });

      return this.analyze(repo.id);
    }

    return {
      message: 'Repository creation and sync started',
      repositoryId: repo.id,
      projectId: targetProjectId,
    };
  }

  private async cloneRepository(repo: any, url: string, branch: string) {
    this.logger.log(`Cloning repository ${repo.id} from ${url} (branch: ${branch})`);

    try {
      // Update status to INDEXING
      await this.prisma.repository.update({
        where: { id: repo.id },
        data: { status: 'INDEXING' },
      });

      this.logger.log(`Repository ${repo.id} status updated to INDEXING`);

      // Get project path
      const projectPath = this.storage.getProjectPath(repo.projectId);
      await this.storage.ensureProjectDirectory(repo.projectId);

      // Clone the repository using git command
      const repoPath = path.join(projectPath, repo.id);

      this.logger.log(`Cloning to path: ${repoPath}`);
      await execAsync(`git clone --branch ${branch} --depth 1 ${url} ${repoPath}`);
      this.logger.log(`Clone completed for repository ${repo.id}`);

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

      // Automatically trigger analysis after cloning
      this.logger.log(`Starting automatic analysis for repository ${repo.id}`);
      this.analyze(repo.id).catch((error) => {
        this.logger.error(`Failed to analyze repository ${repo.id} after cloning:`, error);
        this.logger.error(error.stack);
      });
    } catch (error) {
      this.logger.error(`Clone failed for repository ${repo.id}:`, error);
      this.logger.error(error.stack);

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
    const repo = await this.prisma.repository.findUnique({
      where: { id },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    // Get the Repo record (different from Repository)
    let repoRecord = await this.prisma.repo.findUnique({
      where: { id },
    });

    if (!repoRecord && repo.path) {
      this.logger.log(`Creating missing Repo record for local repository ${id}`);
      repoRecord = await this.prisma.repo.create({
        data: {
          id: repo.id,
          provider: 'local',
          owner: 'local',
          name: path.basename(repo.path),
          fullName: `local/${path.basename(repo.path)}`,
          url: '',
          latestSha: 'local',
        },
      });
    }

    if (!repoRecord) {
      throw new NotFoundException('Repo record not found. Repository may not be cloned yet.');
    }

    if (!repo.path) {
      throw new Error('Repository path not set. Please clone the repository first.');
    }

    this.logger.log(`Starting analysis for repository ${id} at path ${repo.path}`);

    // Update status to INDEXING (we're indexing/analyzing the repository)
    await this.prisma.repository.update({
      where: { id },
      data: { status: 'INDEXING' },
    });

    try {
      // Scan all files in the repository
      const files = await this.scanRepositoryFiles(repo.path);
      this.logger.log(`Found ${files.length} files to process`);

      // Get commit SHA
      const { stdout: commitSha } = await execAsync(`git rev-parse HEAD`, { cwd: repo.path });
      const sha = commitSha.trim();

      let processedCount = 0;
      let skippedCount = 0;

      // Process each file
      for (const filePath of files) {
        try {
          // Read file content
          const content = fs.readFileSync(filePath, 'utf8');

          // Skip if too large
          if (content.length > this.MAX_FILE_SIZE) {
            this.logger.warn(`Skipping large file: ${filePath} (${content.length} bytes)`);
            skippedCount++;
            continue;
          }

          // Calculate blob SHA
          const blobSha = crypto.createHash('sha256').update(content).digest('hex');

          // Check if FileBlob already exists
          const existingBlob = await this.prisma.fileBlob.findFirst({
            where: {
              repoId: id,
              sha: blobSha,
            },
          });

          const relativePath = path.relative(repo.path, filePath);

          if (existingBlob) {
            if (existingBlob.parsedAt) {
              // File already successfully parsed, skip
              continue;
            }
            
            this.logger.log(`FileBlob exists for ${relativePath} but not parsed. Re-enqueuing...`);
            
            // Re-enqueue parse job for existing blob
            await this.queue.enqueue('parse-files', {
              repoId: id,
              sha,
              path: relativePath,
              blobSha,
            });
            
            processedCount++;
            continue;
          }

          // Store file in S3
          const s3Key = await this.s3.storeFile(id, sha, relativePath, content);


          // Create FileBlob record
          const fileBlob = await this.prisma.fileBlob.create({
            data: {
              repoId: id,
              sha: blobSha,
              path: relativePath,
              size: content.length,
              s3Key,
            },
          });

          // Enqueue parse job
          await this.queue.enqueue('parse-files', {
            repoId: id,
            sha,
            path: relativePath,
            blobSha,
          });

          processedCount++;
        } catch (error) {
          this.logger.warn(`Failed to process file ${filePath}:`, error);
          skippedCount++;
        }
      }

      // Enqueue deferred cross-file symbol resolution.
      // Delayed by 30s to allow concurrent parse workers to finish first;
      // the resolver is idempotent so running early just means fewer refs found.
      await this.queue.enqueue(
        'resolve-cross-file-refs',
        { repoId: id },
        { delay: 30_000, jobId: `resolve-xfile-${id}-${Date.now()}` }
      );

      // Update status back to INDEXED
      await this.prisma.repository.update({
        where: { id },
        data: {
          status: 'INDEXED',
          lastIndexed: new Date(),
        },
      });

      this.logger.log(
        `Analysis complete for repository ${id}: ${processedCount} files processed, ${skippedCount} skipped`
      );

      return {
        message: 'Analysis started',
        repositoryId: id,
        filesProcessed: processedCount,
        filesSkipped: skippedCount,
        totalFiles: files.length,
      };
    } catch (error) {
      // Update status to FAILED
      await this.prisma.repository.update({
        where: { id },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  /**
   * Recursively scan repository directory for code files
   */
  private async scanRepositoryFiles(repoPath: string): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = new Set<string>();

    // Get all supported file extensions from parser config
    const languages = this.parserConfig.getAllLanguages();
    for (const lang of languages) {
      for (const ext of lang.extensions) {
        supportedExtensions.add(ext.toLowerCase());
      }
    }

    // Directories to skip
    const skipDirs = new Set([
      '.git',
      'node_modules',
      '.next',
      'dist',
      'build',
      '.venv',
      'venv',
      '__pycache__',
      '.idea',
      '.vscode',
      'target',
      'bin',
      'obj',
      '.gradle',
    ]);

    const walkDir = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip hidden files/directories (except .env, .gitignore, etc.)
          if (
            entry.name.startsWith('.') &&
            entry.name !== '.env' &&
            entry.name !== '.gitignore' &&
            entry.name !== '.dockerignore'
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            // Skip certain directories
            if (!skipDirs.has(entry.name)) {
              walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            // Check if file extension is supported
            const ext = path.extname(entry.name).slice(1).toLowerCase();
            if (
              supportedExtensions.has(ext) ||
              entry.name === '.env' ||
              entry.name === '.gitignore'
            ) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Error reading directory ${dir}:`, error);
      }
    };

    walkDir(repoPath);
    return files;
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

    const user = await this.prisma.user.findUnique({
      where: { id: this.SYSTEM_USER_ID },
    });

    if (!user) {
      await this.prisma.user.create({
        data: {
          id: this.SYSTEM_USER_ID,
          email: 'system@repolens.ai',
          username: 'system',
        },
      });
    }
  }

  async getLocalCodebases() {
    const fs = require('fs');
    const path = require('path');
    const codebasesPath = path.join(process.cwd(), 'codebases');
    
    if (!fs.existsSync(codebasesPath)) {
      return [];
    }

    const dirs = fs.readdirSync(codebasesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        name: dirent.name,
        path: path.join(codebasesPath, dirent.name)
      }));

    return dirs;
  }
}
