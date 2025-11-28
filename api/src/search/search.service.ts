import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { ConfigService } from '../common/config/config.service';
import { TensorService } from '../common/tensor/tensor.service';
import { CitationService } from '../common/citation/citation.service';

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
    query: string,
    repoId?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{ id: string; similarity: number; filePath: string; summary: string | null; chunkText: string }>> {
    this.logger.log(`Semantic search for: ${query}`);

    try {
      // Generate embedding for query
      const embedResponse = await this.tensor.embed([query]);
      
      if (!embedResponse.vectors || embedResponse.vectors.length === 0) {
        this.logger.warn('Failed to generate query embedding, falling back to basic search');
        const results = await this.search(query, repoId);
        return results.map((r) => ({
          id: r.id,
          similarity: 0.5, // Default similarity for non-vector results
          filePath: r.filePath,
          summary: r.summary,
          chunkText: r.chunkText,
        }));
      }

      const queryVector = embedResponse.vectors[0];

      // Search using pgvector
      const similarVectors = await this.prisma.searchSimilarVectors(
        queryVector,
        repoId,
        limit,
        threshold
      );

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
      this.logger.error('Semantic search failed, falling back to basic search:', error);
    const results = await this.search(query, repoId);
      return results.map((r) => ({
        id: r.id,
        similarity: 0.5,
        filePath: r.filePath,
        summary: r.summary,
        chunkText: r.chunkText,
      }));
    }
  }

  async searchWithRAG(query: string, repoId?: string, useVectorSearch: boolean = true): Promise<string> {
    const results = useVectorSearch
      ? await this.semanticSearch(query, repoId)
      : await this.search(query, repoId);

    // Enhance with full citations
    const citations = await this.citation.enhanceWithCitations(results);
    const context = this.citation.formatCitationsForRAG(citations);

    const prompt = `System: You are a code assistant. Use ONLY the CONTEXT blocks (@) provided below to answer. Cite blocks inline like [@1]. Higher similarity scores indicate more relevant matches. Include line numbers in citations like [@1:10-15]. If you cannot answer using only the provided contexts, reply: "INSUFFICIENT CONTEXT. Recommend specific files or symbols to inspect: <list>."

User question: ${query}

Context:
${context}

Assistant:`;

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
