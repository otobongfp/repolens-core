import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { getProjectCodeScopeRepoIds } from './project-scope.util';
import {
  tokenizeRequirement,
  tokenizeCode,
  structuralOverlap,
} from './structural-tokens.util';
import { applyGraphPropagation } from './graph-propagation.util';
import type { MatcherStrategy, MatchResult, RequirementForMatch } from './types';

@Injectable()
export class StructuralOnlyMatcher implements MatcherStrategy {
  readonly matcherType = 'structural-only' as const;
  private readonly logger = new Logger(StructuralOnlyMatcher.name);

  constructor(private readonly prisma: PrismaService) {}

  async match(
    requirement: RequirementForMatch,
    projectId: string,
    _options?: { useGraphPropagation?: boolean; useSymbolMatching?: boolean }
  ): Promise<MatchResult[]> {
    const repoIds = await getProjectCodeScopeRepoIds(this.prisma, projectId);
    if (repoIds.length === 0) return [];

    const requirementTokens = tokenizeRequirement(requirement.text, { stem: true });
    if (requirementTokens.length === 0) return [];

    const nodes = await this.prisma.node.findMany({
      where: { repoId: { in: repoIds } },
      select: {
        id: true,
        nodePath: true,
        filePath: true,
        signature: true,
        symbol: { select: { name: true, signature: true } },
      },
    });

    const scored: Array<{ nodeId: string; score: number }> = [];
    for (const node of nodes) {
      const tokensName = tokenizeCode(node.symbol?.name ?? '');
      const tokensPath = tokenizeCode(node.nodePath);
      const tokensFile = tokenizeCode(node.filePath);
      const tokensSig = [
        ...tokenizeCode(node.signature ?? ''),
        ...tokenizeCode(node.symbol?.signature ?? ''),
      ];
      const overlap = structuralOverlap(
        requirementTokens,
        tokensName,
        tokensPath,
        tokensFile,
        tokensSig
      );
      if (overlap > 0) {
        scored.push({ nodeId: node.id, score: overlap });
      }
    }

    let results: MatchResult[] = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((s) => ({
        nodeId: s.nodeId,
        similarity: s.score,
        symbolMatch: false,
        structuralMatch: true,
      }));

    if (results.length > 0) {
      results = await applyGraphPropagation(
        this.prisma,
        results,
        repoIds,
        0.15
      );
    }

    return results
      .slice(0, 20)
      .map((r) => ({ ...r, similarity: Math.min(1, r.similarity) }));
  }

}
