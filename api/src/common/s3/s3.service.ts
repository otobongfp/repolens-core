import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream } from 'fs';

const execAsync = promisify(exec);

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client | null = null;
  private bucket: string;
  private useLocalStorage: boolean;
  private localStoragePath: string;

  constructor(private readonly configService: ConfigService) {
    // Check if local storage mode is enabled
    this.useLocalStorage = process.env.LOCAL_STORAGE === 'true';
    this.bucket = process.env.S3_BUCKET || 'repolens-artifacts';
    this.localStoragePath = path.join(process.cwd(), 'storage', 'any-bucket');

    if (!this.useLocalStorage) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: process.env.AWS_ACCESS_KEY_ID
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            }
          : undefined,
      });
    } else {
      this.logger.log(`Using local storage at: ${this.localStoragePath}`);
      this.ensureLocalStorageDirectory();
    }
  }

  private async ensureLocalStorageDirectory() {
    try {
      await fs.mkdir(this.localStoragePath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create local storage directory:', error);
    }
  }

  private getLocalPath(key: string): string {
    return path.join(this.localStoragePath, key);
  }

  async uploadRepository(repoId: string, repoPath: string): Promise<string> {
    const key = `repos/${repoId}/source.tar.gz`;

    if (this.useLocalStorage) {
      // In local mode, create tar.gz in local storage
      const localPath = this.getLocalPath(key);
      try {
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        // Create tar.gz archive
        await execAsync(
          `tar -czf "${localPath}" -C "${path.dirname(repoPath)}" "${path.basename(repoPath)}"`
        );
        this.logger.debug(`Created repository archive locally: ${key}`);
        return key;
      } catch (error) {
        this.logger.error(`Failed to create repository archive locally: ${key}`, error);
        throw error;
      }
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      // Create temporary tar.gz file
      const tempDir = path.join(process.cwd(), 'tmp');
      await fs.mkdir(tempDir, { recursive: true });
      const tempArchive = path.join(tempDir, `${repoId}-${Date.now()}.tar.gz`);

      // Create tar.gz archive
      await execAsync(
        `tar -czf "${tempArchive}" -C "${path.dirname(repoPath)}" "${path.basename(repoPath)}"`
      );

      // Read archive file
      const archiveContent = await fs.readFile(tempArchive);

      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: archiveContent,
          ContentType: 'application/gzip',
        })
      );

      // Clean up temporary file
      await fs.unlink(tempArchive).catch(() => {
        // Ignore cleanup errors
      });

      this.logger.log(`Uploaded repository archive to S3: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload repository archive to S3: ${key}`, error);
      throw error;
    }
  }

  async getFileContent(s3Key: string): Promise<string> {
    if (this.useLocalStorage) {
      const localPath = this.getLocalPath(s3Key);
      try {
        return await fs.readFile(localPath, 'utf-8');
      } catch (error) {
        this.logger.error(`Failed to read file from local storage: ${s3Key}`, error);
        return '';
      }
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      const response = await this.s3Client.send(command);
      const chunks: Uint8Array[] = [];

      if (response.Body) {
        for await (const chunk of response.Body as any) {
          chunks.push(chunk);
        }
      }

      return Buffer.concat(chunks).toString('utf-8');
    } catch (error) {
      this.logger.error(`Failed to get file from S3: ${s3Key}`, error);
      return '';
    }
  }

  async storeFile(repoId: string, sha: string, filePath: string, content: string): Promise<string> {
    const key = `repos/${repoId}/${sha}/${filePath}`;

    if (this.useLocalStorage) {
      const localPath = this.getLocalPath(key);
      try {
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, content, 'utf-8');
        this.logger.debug(`Stored file locally: ${key}`);
        return key;
      } catch (error) {
        this.logger.error(`Failed to store file locally: ${key}`, error);
        throw error;
      }
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: content,
        })
      );
      return key;
    } catch (error) {
      this.logger.error(`Failed to store file in S3: ${key}`, error);
      throw error;
    }
  }

  async storeAST(repoId: string, sha: string, filePath: string, ast: any): Promise<string> {
    const key = `ast/${repoId}/${sha}/${filePath}.json`;
    const content = JSON.stringify(ast, null, 2);

    if (this.useLocalStorage) {
      const localPath = this.getLocalPath(key);
      try {
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, content, 'utf-8');
        this.logger.debug(`Stored AST locally: ${key}`);
        return key;
      } catch (error) {
        this.logger.error(`Failed to store AST locally: ${key}`, error);
        throw error;
      }
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: content,
          ContentType: 'application/json',
        })
      );
      return key;
    } catch (error) {
      this.logger.error(`Failed to store AST in S3: ${key}`, error);
      throw error;
    }
  }

  async repositoryExists(repoId: string): Promise<boolean> {
    const key = `repos/${repoId}/source.tar.gz`;

    if (this.useLocalStorage) {
      const localPath = this.getLocalPath(key);
      try {
        await fs.access(localPath);
        return true;
      } catch {
        return false;
      }
    }

    if (!this.s3Client) {
      return false;
    }

    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete all files/artifacts for a repository
   */
  async deleteRepositoryArtifacts(repoId: string): Promise<void> {
    this.logger.log(`Deleting all artifacts for repository: ${repoId}`);

    if (this.useLocalStorage) {
      // Delete local storage directory for this repo
      const repoPrefix = `repos/${repoId}`;
      const astPrefix = `ast/${repoId}`;

      try {
        // Delete repos directory
        const reposPath = this.getLocalPath(repoPrefix);
        await fs.rm(reposPath, { recursive: true, force: true }).catch(() => {
          // Ignore if doesn't exist
        });

        // Delete ASTs directory
        const astsPath = this.getLocalPath(astPrefix);
        await fs.rm(astsPath, { recursive: true, force: true }).catch(() => {
          // Ignore if doesn't exist
        });

        this.logger.log(`Deleted local artifacts for repository: ${repoId}`);
      } catch (error) {
        this.logger.warn(`Failed to delete some local artifacts for repository ${repoId}:`, error);
      }
      return;
    }

    if (!this.s3Client) {
      this.logger.warn('S3 client not initialized, cannot delete artifacts');
      return;
    }

    try {
      // Delete all objects with prefix `repos/${repoId}/`
      await this.deleteObjectsWithPrefix(`repos/${repoId}/`);

      // Delete all objects with prefix `ast/${repoId}/`
      await this.deleteObjectsWithPrefix(`ast/${repoId}/`);

      this.logger.log(`Deleted S3 artifacts for repository: ${repoId}`);
    } catch (error) {
      this.logger.error(`Failed to delete S3 artifacts for repository ${repoId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all objects with a given prefix from S3
   */
  private async deleteObjectsWithPrefix(prefix: string): Promise<void> {
    if (!this.s3Client) {
      return;
    }

    let continuationToken: string | undefined;
    let deletedCount = 0;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await this.s3Client.send(listCommand);

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        // Delete objects in batches (S3 allows up to 1000 per request)
        const deletePromises = listResponse.Contents.map((object) =>
          this.s3Client!.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: object.Key!,
            })
          )
        );

        await Promise.all(deletePromises);
        deletedCount += listResponse.Contents.length;
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    if (deletedCount > 0) {
      this.logger.debug(`Deleted ${deletedCount} objects with prefix: ${prefix}`);
    }
  }
}
