import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { SearchService } from '../../search/search.service';
import { getProjectCodeScopeRepoIds } from './project-scope.util';
import type {
  MatcherStrategy,
  MatchResult,
  RequirementForMatch,
  ExperimentMatchOptions,
} from './types';

@Injectable()
export class EmbeddingOnlyMatcher implements MatcherStrategy {
  readonly matcherType = 'embedding' as const;
  private readonly logger = new Logger(EmbeddingOnlyMatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService
  ) {}

  async match(
    requirement: RequirementForMatch,
    projectId: string,
    _options?: ExperimentMatchOptions
  ): Promise<MatchResult[]> {
    const repoIds = await getProjectCodeScopeRepoIds(this.prisma, projectId);
    if (repoIds.length === 0) {
      this.logger.debug(
        `Embedding matcher: no code scope for project ${projectId}. Add repositories to the project and ensure they are analyzed.`
      );
      return [];
    }

    const allMatches: Array<{ id: string; similarity: number }> = [];

    for (const repoId of repoIds) {
      try {
        const results = await this.search.semanticSearch(requirement.vector || requirement.text, repoId, 20, 0.1);
        if (results.length === 0) {
          this.logger.debug(
            `Embedding search returned 0 for repo ${repoId}. Ensure embeddings exist for this repo with vector populated (run analysis) and OPENAI_API_KEY / tensor service are available.`
          );
        }
        allMatches.push(...results.map((r) => ({ id: r.id, similarity: r.similarity })));
      } catch (error) {
        this.logger.warn(`Embedding search failed for repo ${repoId}:`, error);
      }
    }

    if (allMatches.length === 0) return [];

    const embeddingIds = allMatches.map((m) => m.id);
    const embeddings = await this.prisma.embedding.findMany({
      where: { id: { in: embeddingIds } },
      select: { id: true, nodeId: true },
    });

    return allMatches
      .map((match): MatchResult | null => {
        const emb = embeddings.find((e) => e.id === match.id);
        if (!emb?.nodeId) return null;
        return {
          nodeId: emb.nodeId,
          similarity: match.similarity,
          symbolMatch: false,
          structuralMatch: false,
        };
      })
      .filter((m): m is MatchResult => m !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20);
  }
}
