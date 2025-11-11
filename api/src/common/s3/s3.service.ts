import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

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
      // In local mode, just return the key (repository is already on filesystem)
      return key;
    }

    // TODO: Implement actual tar.gz upload to S3
    return key;
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
}
