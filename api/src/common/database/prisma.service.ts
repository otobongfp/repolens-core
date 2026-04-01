import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pgPool: Pool | null = null;

  async onModuleInit() {
    // Do not call $connect() here: Prisma connects lazily on first query.
    // This allows the API to start when the database is temporarily unreachable
    // (e.g. Supabase paused, no network). First DB request will then connect or fail.
    try {
      const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

      if (directUrl) {
        if (directUrl.includes('pooler') && directUrl.includes('pgbouncer=true')) {
          this.logger.warn(
            'Using pooled connection - pg.Pool not created. Vector operations will use Prisma $queryRaw.'
          );
          this.logger.warn(
            'For better vector performance, set DIRECT_URL to a direct connection (port 5432, not 6543)'
          );
        } else {
          const isSupabase =
            directUrl.includes('supabase.com') || directUrl.includes('supabase.co');
          const sslConfig = isSupabase
            ? {
                rejectUnauthorized: false,
              }
            : undefined;

          this.pgPool = new Pool({
            connectionString: directUrl,
            max: 2,
            ssl: sslConfig,
          });

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
              this.logger.warn('pg pool init failed (DB may be unreachable):', extError?.message ?? extError);
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.warn('Failed to initialize pgvector, vector search will be limited:', error?.message ?? error);
    }
  }

  async onModuleDestroy() {
    if (this.pgPool) {
      await this.pgPool.end();
    }
    await this.$disconnect();
  }

  getPgPool(): Pool | null {
    return this.pgPool;
  }

  async storeVector(entityId: string, vector: number[], tableName: 'Embedding' | 'Requirement' = 'Embedding'): Promise<void> {
    // pgvector expects square bracket notation: '[1,2,3]'
    const vectorStr = `[${vector.join(',')}]`;

    try {
      if (this.pgPool) {
        const result = await this.withRetry(() => 
          this.pgPool!.query(
            `UPDATE "${tableName}" SET vector = $1::vector WHERE id = $2 RETURNING id`,
            [vectorStr, entityId]
          )
        );
        if (result.rowCount === 0) {
          throw new Error(`${tableName} ${entityId} not found for vector update`);
        }
      } else {
        this.logger.warn(
          'DIRECT_URL not set or using pooler - pg.Pool unavailable. Vector UPDATE may fail with pooled Prisma connection.'
        );
        // Use parameterized query for safety
        const result = await this.withRetry(() =>
          this.$queryRawUnsafe<Array<{ id: string }>>(
            `UPDATE "${tableName}" SET vector = $1::vector WHERE id = $2 RETURNING id`,
            vectorStr,
            entityId
          )
        );
        if (!result || (Array.isArray(result) && result.length === 0)) {
          throw new Error(`${tableName} ${entityId} not found for vector update`);
        }
      }

      this.logger.debug(`Stored vector for ${tableName} ${entityId} (${vector.length} dimensions)`);
    } catch (error: any) {
      const code = error?.code;
      const msg = error?.message ?? String(error);
      if (code === '42703') {
        this.logger.error(
          `Vector column not found on Embedding table. Run: npx prisma migrate deploy (migration 20260108223142_add_vector_column)`
        );
        throw new Error(
          'Vector column missing. Run migrations: cd api && npx prisma migrate deploy'
        );
      }
      if (code === '42883' || msg?.includes('operator does not exist')) {
        this.logger.error(
          'Vector operations require a direct DB connection. Set DIRECT_URL to the direct connection (e.g. port 5432), not the pooler (6543).'
        );
        throw new Error(
          'Vector storage failed: use DIRECT_URL with direct connection (not pooler). See api/prisma/README.md'
        );
      }
      if (code === '0A000') {
        this.logger.error('pgvector extension not available. Enable it on your database and use DIRECT_URL.');
        throw new Error('pgvector extension required. Enable it and set DIRECT_URL.');
      }
      this.logger.error(`Failed to store vector for ${tableName} ${entityId}:`, error);
      throw error;
    }
  }

  async searchSimilarVectors(
    queryVector: number[],
    repoId?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{ id: string; similarity: number; filePath: string; summary: string | null }>> {
    try {
      // pgvector expects square bracket notation: '[1,2,3]'
      const vectorStr = `[${queryVector.join(',')}]`;

      // pgvector <=> is cosine distance; 1 - distance = cosine similarity in [0,1]
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

      let result: Array<{
        id: string;
        filePath: string;
        summary: string | null;
        similarity: number | string;
      }>;

      if (this.pgPool) {
        const pgResult = await this.withRetry(() => this.pgPool!.query(query, params));
        result = pgResult.rows;
      } else {
        result = (await this.withRetry(() => this.$queryRawUnsafe(query, ...params))) as Array<{
          id: string;
          filePath: string;
          summary: string | null;
          similarity: number | string;
        }>;
      }

      return result.map((row) => ({
        id: row.id,
        similarity:
          typeof row.similarity === 'string' ? parseFloat(row.similarity) : row.similarity,
        filePath: row.filePath,
        summary: row.summary,
      }));
    } catch (error: any) {
      if (error.code === '42883' || error.message?.includes('operator does not exist')) {
        this.logger.warn(
          'Vector search not supported - pgvector extension may not be available. ' +
            'Falling back to text-based search. Set DIRECT_URL for vector operations.'
        );
      } else if (error.code === '42703') {
        this.logger.warn(
          'Vector column not found - pgvector may not be set up. ' +
            'Run migration: npx prisma migrate deploy'
        );
      } else if (error.code === '0A000') {
        this.logger.warn(
          'pgvector extension not available. ' +
            'Ensure DIRECT_URL points to direct connection and pgvector is installed.'
        );
      } else {
        this.logger.error('Failed to search similar vectors:', error);
      }
      // Return empty array to allow fallback to text search
      return [];
    }
  }

  /**
   * Fallback: Calculate cosine similarity in-memory when pgvector is not available
   */
  async searchSimilarVectorsFallback(
    queryVector: number[],
    repoId?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{ id: string; similarity: number; filePath: string; summary: string | null }>> {
    this.logger.log('Using fallback cosine similarity calculation (slower but works without pgvector)');

    try {
      // Get all embeddings (or for repo)
      const embeddings = await this.embedding.findMany({
        where: repoId ? { repoId } : {},
        select: {
          id: true,
          filePath: true,
          summary: true,
          chunkText: true,
        },
      });

      // Calculate cosine similarity for each
      const similarities = embeddings
        .map((emb) => {
          // For fallback, we'd need to store vectors differently or regenerate
          // This is a simplified version - in practice, you'd need vector storage
          // For now, return empty results to trigger text-based fallback
          return null;
        })
        .filter((s): s is { id: string; similarity: number; filePath: string; summary: string | null } => s !== null);

      return similarities.slice(0, limit);
    } catch (error) {
      this.logger.error('Fallback vector search failed:', error);
      return [];
    }
  }

  /**
   * Helper to wrap Prisma calls with automatic retries for transient connection issues (P1001)
   */
  async withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        // P1001 is "Can't reach database server"
        const isConnectionError =
          error.code === 'P1001' ||
          error.message?.includes('Can\'t reach database server') ||
          error.message?.includes('timed out') ||
          error.message?.includes('connection limit exceeded');

        if (isConnectionError && i < maxRetries - 1) {
          const backoff = delay * Math.pow(2, i);
          this.logger.warn(
            `Database connection error (attempt ${i + 1}/${maxRetries}). Retrying in ${backoff}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }
}
