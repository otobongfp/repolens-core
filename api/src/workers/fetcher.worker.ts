import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { S3Service } from '../common/s3/s3.service';
import { QueueService } from '../common/queue/queue.service';
import { GitHubAuthService } from '../common/github/github-auth.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

@Injectable()
export class FetcherWorker {
  private readonly logger = new Logger(FetcherWorker.name);
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly queue: QueueService,
    private readonly githubAuth: GitHubAuthService
  ) {}

  async process(job: any) {
    const { provider, repoFull, event, payload } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing ${event} event for ${repoFull}`);

    try {
      if (event === 'push') {
        await this.handlePushEvent(provider, repoFull, payload);
      } else if (event === 'pull_request') {
        await this.handlePullRequestEvent(provider, repoFull, payload);
      }
      
      const duration = (Date.now() - startTime) / 1000;
      this.logger.debug(`Processed ${event} in ${duration}s`);
    } catch (error) {
      this.logger.error(`Failed to process ${event}:`, error);
      throw error;
    }
  }

  private async handlePushEvent(provider: string, repoFull: string, payload: any) {
    const oldSha = payload.before;
    const newSha = payload.after;
    const ref = payload.ref;

    // Find repo in our database
    const [owner, name] = repoFull.split('/');
    const repo = await this.prisma.repo.findFirst({
      where: {
        provider,
        owner,
        name,
      },
    });

    if (!repo) {
      this.logger.warn(`Repo ${repoFull} not found in database`);
      return;
    }

    if (provider === 'github' && repo.installationId) {
      await this.fetchChangedFilesGitHub(repo, oldSha, newSha);
    } else {
      // Fallback to git clone
      await this.fetchWithGit(repo, newSha);
    }
  }

  private async handlePullRequestEvent(provider: string, repoFull: string, payload: any) {
    this.logger.log(`PR event received for ${repoFull}`);
  }

  private async fetchChangedFilesGitHub(repo: any, oldSha: string, newSha: string) {
    // Get token from installation or fallback to env
    const token = await this.githubAuth.getToken(repo.id);

    if (!token) {
      throw new Error(`No GitHub token available for repo ${repo.id}`);
    }

    try {
      // Use GitHub API to compare commits
      const response = await fetch(
        `https://api.github.com/repos/${repo.fullName}/compare/${oldSha}...${newSha}`,
        {
          headers: {
            Authorization: `token ${token}`,
          },
        }
      );

      const compare = await response.json();

      for (const file of compare.files) {
        // Skip binaries and large files
        if (this.isBinary(file) || file.changes > this.MAX_FILE_SIZE) {
          this.logger.warn(`Skipping large/binary file: ${file.filename}`);
          continue;
        }

        // Fetch file content
        const contentResponse = await fetch(
          `https://api.github.com/repos/${repo.fullName}/contents/${file.filename}?ref=${newSha}`,
          {
            headers: {
              Authorization: `token ${token}`,
            },
          }
        );

        const fileData = await contentResponse.json();
        const content = Buffer.from(fileData.content, 'base64').toString('utf8');

        // Store in S3
        const blobSha = crypto.createHash('sha256').update(content).digest('hex');
        const s3Key = await this.s3.storeFile(repo.id, newSha, file.filename, content);

        // Create FileBlob record
        await this.prisma.fileBlob.create({
          data: {
            repoId: repo.id,
            sha: blobSha,
            path: file.filename,
            size: content.length,
            s3Key,
          },
        });

        // Enqueue parse job
        await this.queue.enqueue('parse-files', {
          repoId: repo.id,
          sha: newSha,
          path: file.filename,
          blobSha,
        });
      }

      // Update repo's latest SHA
      await this.prisma.repo.update({
        where: { id: repo.id },
        data: { latestSha: newSha },
      });
    } catch (error) {
      this.logger.error('Failed to fetch from GitHub:', error);
      throw error;
    }
  }

  private async fetchWithGit(repo: any, sha: string) {
    this.logger.log(`Fetching ${repo.fullName} with git`);
  }

  private isBinary(file: any): boolean {
    const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.jpg', '.png', '.pdf'];
    return binaryExtensions.some((ext) => file.filename.endsWith(ext));
  }
}
