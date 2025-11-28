import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pgPool: Pool | null = null;

  async onModuleInit() {
    await this.$connect();

    try {
      // Prefer DIRECT_URL for vector operations (Supabase direct connection)
      // Fall back to DATABASE_URL if DIRECT_URL not set
      const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

      if (directUrl) {
        // Only create pool if we have a direct connection URL
        // If using pooled connection (pgbouncer), skip pool creation
        // Vector operations will use Prisma's $queryRaw instead
        if (directUrl.includes('pooler') && directUrl.includes('pgbouncer=true')) {
          this.logger.warn(
            'Using pooled connection - pg.Pool not created. Vector operations will use Prisma $queryRaw.'
          );
          this.logger.warn(
            'For better vector performance, set DIRECT_URL to a direct connection (port 5432, not 6543)'
          );
        } else {
          // Parse connection string to check if SSL is needed (Supabase requires SSL)
          const isSupabase =
            directUrl.includes('supabase.com') || directUrl.includes('supabase.co');
          const sslConfig = isSupabase
            ? {
                rejectUnauthorized: false, // Supabase uses self-signed certificates
              }
            : undefined;

          this.pgPool = new Pool({
            connectionString: directUrl,
            max: 2, // Limit pool size to avoid connection exhaustion
            ssl: sslConfig,
          });

          // Enable pgvector extension (only works on direct connections)
          try {
            await this.pgPool.query('CREATE EXTENSION IF NOT EXISTS vector');
            this.logger.log('pgvector extension enabled');
          } catch (extError: any) {
            if (extError.code === '0A000') {
              this.logger.warn(
                'pgvector extension not available. Vector search will be limited. ' +
                  'Ensure DIRECT_URL points to a direct connection (not pooler).'
              );
            } else {
              throw extError;
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to initialize pgvector, vector search will be limited:', error);
    }
  }

  async onModuleDestroy() {
    if (this.pgPool) {
      await this.pgPool.end();
    }
    await this.$disconnect();
  }

  /**
   * Get raw PostgreSQL connection for vector operations
   */
  getPgPool(): Pool | null {
    return this.pgPool;
  }

  /**
   * Store vector embedding in pgvector
   */
  async storeVector(embeddingId: string, vector: number[]): Promise<void> {
    try {
      // Convert array to pgvector format: '[1,2,3]'
      const vectorStr = `[${vector.join(',')}]`;

      await this.$executeRawUnsafe(
        `UPDATE "Embedding" SET vector = $1::vector WHERE id = $2`,
        vectorStr,
        embeddingId
      );

      this.logger.debug(`Stored vector for embedding ${embeddingId} (${vector.length} dimensions)`);
    } catch (error: any) {
      // If using pooled connection, vector operations might not work
      if (error.code === '42883' || error.message?.includes('operator does not exist')) {
        this.logger.warn(
          `Vector operations not supported with pooled connection. ` +
            `Set DIRECT_URL for vector operations or use direct connection.`
        );
      } else {
        this.logger.error(`Failed to store vector for embedding ${embeddingId}:`, error);
      }
      // Don't throw - allow system to continue without vector
    }
  }

  /**
   * Search for similar embeddings using vector similarity
   */
  async searchSimilarVectors(
    queryVector: number[],
    repoId?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{ id: string; similarity: number; filePath: string; summary: string | null }>> {
    try {
      const vectorStr = `[${queryVector.join(',')}]`;

      // Use Prisma's $queryRawUnsafe for vector operations
      // This works with both pooled and direct connections
      let query = `
        SELECT 
          id,
          "filePath",
          summary,
          1 - (vector <=> $1::vector) as similarity
        FROM "Embedding"
        WHERE vector IS NOT NULL
      `;

      const params: any[] = [vectorStr];

      if (repoId) {
        query += ` AND "repoId" = $2`;
        params.push(repoId);
      }

      query += `
        AND (1 - (vector <=> $1::vector)) >= $3
        ORDER BY vector <=> $1::vector
        LIMIT $4
      `;
      params.push(threshold, limit);

      // Use Prisma's queryRaw with proper parameterization
      const result = (await this.$queryRawUnsafe(query, ...params)) as Array<{
        id: string;
        filePath: string;
        summary: string | null;
        similarity: number | string;
      }>;

      return result.map((row) => ({
        id: row.id,
        similarity:
          typeof row.similarity === 'string' ? parseFloat(row.similarity) : row.similarity,
        filePath: row.filePath,
        summary: row.summary,
      }));
    } catch (error: any) {
      // If using pooled connection, vector operations might not work
      if (error.code === '42883' || error.message?.includes('operator does not exist')) {
        this.logger.warn(
          'Vector search not supported with pooled connection. ' +
            'Set DIRECT_URL for vector operations or use direct connection.'
        );
      } else {
        this.logger.error('Failed to search similar vectors:', error);
      }
      return []; // Return empty array instead of throwing
    }
  }
}
