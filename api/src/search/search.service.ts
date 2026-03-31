import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { ConfigService } from '../common/config/config.service';
import { TensorService } from '../common/tensor/tensor.service';
import { CitationService } from '../common/citation/citation.service';

import { getRAGSearchPrompt } from '../common/prompts';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tensor: TensorService,
    private readonly citation: CitationService
  ) {}

  /**
   * Basic search without vector similarity (fallback)
   */
  async search(query: string, repoId?: string): Promise<any[]> {
    this.logger.log(`Searching for: ${query}`);

    return this.prisma.embedding.findMany({
      where: repoId ? { repoId } : {},
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    queryOrVector: string | number[],
    repoId?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<
    Array<{
      id: string;
      similarity: number;
      filePath: string;
      summary: string | null;
      chunkText: string;
    }>
  > {
    const isVector = Array.isArray(queryOrVector);
    const queryStr = isVector ? 'precomputed vector' : queryOrVector;
    this.logger.log(`Semantic search for: ${queryStr}`);

    try {
      let queryVector: number[];

      if (isVector) {
        queryVector = queryOrVector;
      } else {
        // Generate embedding for query
        const embedResponse = await this.tensor.embed([queryOrVector]);

        if (!embedResponse.vectors || embedResponse.vectors.length === 0) {
          this.logger.warn(
            'Failed to generate query embedding; returning no results (embeddings-only mode)'
          );
          return [];
        }
        queryVector = embedResponse.vectors[0];
      }

      const expectedDim = 1536; // must match Embedding.vector column and tensor.embed output
      if (queryVector.length !== expectedDim) {
        this.logger.error(
          `Query vector has ${queryVector.length} dimensions; DB expects ${expectedDim}. ` +
            'If you see "different vector dimensions 1536 and 384", some stored embeddings were created with a different model/dimensions. Re-run analysis on the repo to regenerate all embeddings with the current model (1536).'
        );
        return [];
      }
      this.logger.debug(`Generated/received query vector with ${queryVector.length} dimensions`);

      // Check if embeddings exist for this repo
      const embeddingCount = await this.prisma.embedding.count({
        where: repoId ? { repoId } : {},
      });
      this.logger.log(`Found ${embeddingCount} embeddings for repo ${repoId || 'all repos'}`);

      // Check how many have vectors
      let vectorCountQuery = 'SELECT COUNT(*) as count FROM "Embedding" WHERE vector IS NOT NULL';
      const vectorCountParams: any[] = [];

      if (repoId) {
        vectorCountQuery += ' AND "repoId" = $1';
        vectorCountParams.push(repoId);
      }

      const vectorCountResult = await this.prisma
        .$queryRawUnsafe<Array<{ count: bigint }>>(vectorCountQuery, ...vectorCountParams)
        .catch(() => [{ count: 0n }]);

      const vectorsAvailable = Number(vectorCountResult[0]?.count || 0);
      this.logger.log(`Found ${vectorsAvailable} embeddings with vectors stored`);

      if (vectorsAvailable === 0) {
        this.logger.warn(
          'No embeddings with vectors found. Repository may need to be analyzed first.'
        );
        return [];
      }

      // Search using pgvector
      const similarVectors = await this.prisma.searchSimilarVectors(
        queryVector,
        repoId,
        limit,
        threshold
      );

      this.logger.log(
        `Vector search returned ${similarVectors.length} results with threshold ${threshold}`
      );

      if (similarVectors.length === 0) {
        this.logger.log(`No vector results above threshold ${threshold}`);
        return [];
      }

      // Get full embedding records
      const embeddingIds = similarVectors.map((v) => v.id);
      const embeddings = await this.prisma.embedding.findMany({
        where: { id: { in: embeddingIds } },
      });

      // Combine similarity scores with full records
      const results = similarVectors.map((sv) => {
        const embedding = embeddings.find((e) => e.id === sv.id);
        return {
          id: sv.id,
          similarity: sv.similarity,
          filePath: sv.filePath,
          summary: sv.summary,
          chunkText: embedding?.chunkText || '',
        };
      });

      return results;
    } catch (error) {
      this.logger.error('Semantic search failed (embeddings-only):', error);
      return [];
    }
  }

  async searchWithRAG(
    query: string,
    repoId?: string,
    useVectorSearch: boolean = true
  ): Promise<string> {
    const results = useVectorSearch
      ? await this.semanticSearch(query, repoId)
      : await this.search(query, repoId);

    // Enhance with full citations
    const citations = await this.citation.enhanceWithCitations(results);
    const context = this.citation.formatCitationsForRAG(citations);

    const prompt = getRAGSearchPrompt(query, context);

    return prompt;
  }

  /**
   * Search with full citations for API responses
   */
  async searchWithCitations(
    query: string,
    repoId?: string,
    limit: number = 10
  ): Promise<{
    query: string;
    results: Array<{
      id: string;
      filePath: string;
      lines: { start: number; end: number };
      code: string;
      summary: string | null;
      similarity: number;
      nodeType?: string;
    }>;
  }> {
    const results = await this.semanticSearch(query, repoId, limit);
    const citations = await this.citation.enhanceWithCitations(results);
    const formatted = this.citation.formatCitationsForResponse(citations);

    return {
      query,
      results: formatted,
    };
  }
}
