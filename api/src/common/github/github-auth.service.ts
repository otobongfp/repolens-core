import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class GitHubAuthService {
  private readonly logger = new Logger(GitHubAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get GitHub token for a repository
   * Tries installation token first, falls back to env token
   */
  async getToken(repoId: string): Promise<string | null> {
    try {
      // Find repo with installation
      const repo = await this.prisma.repo.findUnique({
        where: { id: repoId },
        include: { installation: true },
      });

      if (repo?.installation) {
        // Decrypt and return installation token
        const token = this.decryptToken(repo.installation.encryptedToken);
        
        if (repo.installation.expiresAt && repo.installation.expiresAt < new Date()) {
          this.logger.warn(`Installation token expired for repo ${repoId}, refreshing...`);
          return null;
        }

        return token;
      }

      // Fallback to environment variable
      const envToken = process.env.GITHUB_TOKEN;
      if (envToken) {
        this.logger.debug('Using GITHUB_TOKEN from environment');
        return envToken;
      }

      this.logger.warn(`No GitHub token available for repo ${repoId}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to get GitHub token for repo ${repoId}:`, error);
      return process.env.GITHUB_TOKEN || null;
    }
  }

  /**
   * Encrypt token before storing
   */
  encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || this.getDefaultKey(), 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt stored token
   */
  decryptToken(encryptedToken: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(process.env.ENCRYPTION_KEY || this.getDefaultKey(), 'hex');
      const parts = encryptedToken.split(':');
      
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt token:', error);
      throw error;
    }
  }

  /**
   * Get default encryption key (for development only)
   * In production, ENCRYPTION_KEY should be set in environment
   */
  private getDefaultKey(): string {
    // Generate a consistent key for development
    // WARNING: This is not secure for production!
    return crypto
      .createHash('sha256')
      .update(process.env.DATABASE_URL || 'dev-key')
      .digest('hex');
  }

  /**
   * Store installation token
   */
  async storeInstallationToken(
    provider: string,
    accountId: string,
    token: string,
    expiresAt?: Date
  ): Promise<string> {
    const encryptedToken = this.encryptToken(token);

    // Find existing installation
    const existing = await this.prisma.installation.findFirst({
      where: {
        provider,
        accountId,
      },
    });

    if (existing) {
      await this.prisma.installation.update({
        where: { id: existing.id },
        data: {
          encryptedToken,
          expiresAt,
        },
      });
      return existing.id;
    }

    // Create new installation
    const installation = await this.prisma.installation.create({
      data: {
        provider,
        accountId,
        encryptedToken,
        expiresAt,
      },
    });

    return installation.id;
  }
}

