import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { SearchService } from '../../search/search.service';
import { getProjectCodeScopeRepoIds } from './project-scope.util';
import { applyGraphPropagation } from './graph-propagation.util';
import type {
  MatcherStrategy,
  MatchResult,
  RequirementForMatch,
  ExperimentMatchOptions,
} from './types';

@Injectable()
export class HybridMatcher implements MatcherStrategy {
  readonly matcherType = 'hybrid' as const;
  private readonly logger = new Logger(HybridMatcher.name);

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
    if (repoIds.length === 0) return [];

    const allMatches: Array<{ id: string; similarity: number; summary: string | null; chunkText: string }> = [];

    for (const repoId of repoIds) {
      try {
        // Granular threshold scan to find the best balance of precision and recall
        const thresholdSteps = [
          { threshold: 0.7, limit: 10 },
          { threshold: 0.6, limit: 15 },
          { threshold: 0.5, limit: 20 },
          { threshold: 0.4, limit: 25 },
          { threshold: 0.3, limit: 30 },
          { threshold: 0.1, limit: 40 }, // Last resort
        ];

        // Parallelize all threshold searches for the repository to minimize latency
        const searchAttempts = await Promise.all(
          thresholdSteps.map(async (step) => {
            const results = await this.search.semanticSearch(
              requirement.vector || requirement.text,
              repoId,
              step.limit,
              step.threshold
            );
            return { threshold: step.threshold, results };
          })
        );

        // Pick the result set from the highest threshold that returned anything
        const bestAttempt = searchAttempts
          .sort((a, b) => b.threshold - a.threshold)
          .find((a) => a.results.length > 0);

        const results = bestAttempt?.results || [];
        if (results.length > 0) {
          this.logger.debug(
            `Best results found at threshold ${bestAttempt?.threshold} for repo ${repoId}`
          );
        }

        allMatches.push(
          ...results.map((r) => ({
            id: r.id,
            similarity: r.similarity,
            summary: r.summary,
            chunkText: r.chunkText,
          }))
        );
      } catch (error) {
        this.logger.warn(`Semantic search failed for repo ${repoId}, skipping:`, error);
      }
    }

    if (allMatches.length === 0) return [];

    const embeddingIds = allMatches.map((m) => m.id);
    const embeddings = await this.prisma.embedding.findMany({
      where: { id: { in: embeddingIds } },
      include: { node: { include: { symbol: { select: { name: true } } } } },
    });

    let results: MatchResult[] = allMatches
      .map((match): MatchResult | null => {
        const embedding = embeddings.find((e) => e.id === match.id);
        if (!embedding?.nodeId) return null;
        
        const codeText = this.buildCodeTextForSymbolMatch(embedding);
        const hasSymbolMatch = this.checkSymbolMatch(requirement.text, codeText);
        
        // CALIBRATED SCORING FORMULA:
        // Semantic: 70%, Symbol Match: 30% bonus (max 1.0 overall)
        const semanticWeight = 0.7;
        const symbolWeight = 0.3;
        
        // Initial score from embedding similarity
        let calibratedScore = match.similarity * semanticWeight;
        
        // Add symbol match weight
        if (hasSymbolMatch) {
          calibratedScore += symbolWeight;
        }

        return {
          nodeId: embedding.nodeId,
          similarity: Math.min(1.0, calibratedScore),
          symbolMatch: hasSymbolMatch,
          structuralMatch: false,
        };
      })
      .filter((m): m is MatchResult => m !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 40);

    if (results.length > 0) {
      results = await applyGraphPropagation(this.prisma, results, repoIds, 0.15);
    }

    return results.slice(0, 20);
  }

  /** Build code-side text from all available embedding/node/symbol fields for symbol matching. */
  private buildCodeTextForSymbolMatch(embedding: {
    summary: string | null;
    chunkText: string | null;
    node?: { signature: string | null; symbol?: { name: string | null } | null } | null;
  }): string {
    const parts = [
      embedding.summary,
      embedding.chunkText,
      embedding.node?.signature,
      embedding.node?.symbol?.name,
    ].filter(Boolean) as string[];
    return parts.join(' ').toLowerCase();
  }

  private checkSymbolMatch(requirementText: string, codeText: string): boolean {
    const words = requirementText
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    return words.some((word) => codeText.includes(word));
  }
}
