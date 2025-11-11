import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { S3Service } from '../common/s3/s3.service';
import { QueueService } from '../common/queue/queue.service';
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
    private readonly queue: QueueService
  ) {}

  async process(job: any) {
    const { provider, repoFull, event, payload } = job.data;

    this.logger.log(`Processing ${event} event for ${repoFull}`);

    try {
      if (event === 'push') {
        await this.handlePushEvent(provider, repoFull, payload);
      } else if (event === 'pull_request') {
        await this.handlePullRequestEvent(provider, repoFull, payload);
      }
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
    // TODO: Handle PR events (maybe add PR branches to index)
    this.logger.log(`PR event received for ${repoFull}`);
  }

  private async fetchChangedFilesGitHub(repo: any, oldSha: string, newSha: string) {
    // TODO: Decrypt token from installation
    const token = process.env.GITHUB_TOKEN; // Temporary

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
    // Fallback: git clone method
    this.logger.log(`Fetching ${repo.fullName} with git`);
    // Use existing clone logic from repositories.service.ts
  }

  private isBinary(file: any): boolean {
    // Simple check - in production use magic bytes
    const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.jpg', '.png', '.pdf'];
    return binaryExtensions.some((ext) => file.filename.endsWith(ext));
  }
}
