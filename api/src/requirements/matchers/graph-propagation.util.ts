import { PrismaService } from '../../common/database/prisma.service';
import type { MatchResult } from './types';

const GRAPH_BOOST_ALPHA = 0.15;
const MAX_HOPS = 2;

/**
 * Multi-hop graph propagation using SymbolRef (calls, imports, inherits, references).
 *
 * For each matched node the algorithm propagates outward through the repository's
 * structural graph up to {@link MAX_HOPS} hops:
 *   - hop 1: neighbor boost = α   × source_score
 *   - hop 2: neighbor boost = α²  × source_score
 *
 * This allows a requirement match on function A to also surface function C when
 * the call chain is A → B → C, producing genuinely repository-level structural
 * matches rather than single-file locality.
 *
 * Returns original matches plus boosted neighbors, sorted by score, top 20.
 */
export async function applyGraphPropagation(
  prisma: PrismaService,
  matches: MatchResult[],
  repoIds: string[],
  alpha: number = GRAPH_BOOST_ALPHA
): Promise<MatchResult[]> {
  if (matches.length === 0 || repoIds.length === 0) return matches;

  // Seed scores from initial matches (keep highest when duplicates)
  const scoreByNodeId = new Map<string, number>();
  for (const m of matches) {
    const existing = scoreByNodeId.get(m.nodeId);
    if (existing === undefined || m.similarity > existing) {
      scoreByNodeId.set(m.nodeId, m.similarity);
    }
  }

  // Track the frontier of node IDs to expand at each hop
  let frontier = new Set(scoreByNodeId.keys());
  const allRefs: Array<{ fromNodeId: string; toNodeId: string }> = [];

  for (let hop = 1; hop <= MAX_HOPS; hop++) {
    if (frontier.size === 0) break;

    const frontierIds = [...frontier];
    const refs = await prisma.symbolRef.findMany({
      where: {
        repoId: { in: repoIds },
        OR: [{ fromNodeId: { in: frontierIds } }, { toNodeId: { in: frontierIds } }],
      },
      select: { fromNodeId: true, toNodeId: true },
    });
    
    allRefs.push(...refs);

    const nextFrontier = new Set<string>();
    const decay = Math.pow(alpha, hop);

    for (const ref of refs) {
      const sourceId = frontier.has(ref.fromNodeId) ? ref.fromNodeId : ref.toNodeId;
      const neighborId = ref.fromNodeId === sourceId ? ref.toNodeId : ref.fromNodeId;

      const sourceScore = scoreByNodeId.get(sourceId) ?? 0;
      const boost = decay * sourceScore;
      if (boost <= 0) continue;

      const current = scoreByNodeId.get(neighborId);
      if (current === undefined || boost > current) {
        // Only overwrite if the boosted score is higher (don't downgrade direct matches)
        if (current === undefined) {
          scoreByNodeId.set(neighborId, boost);
          nextFrontier.add(neighborId);
        }
      }
    }

    frontier = nextFrontier;
  }

  const combined: MatchResult[] = [];
  scoreByNodeId.forEach((score, nodeId) => {
    combined.push({
      nodeId,
      similarity: score,
      symbolMatch: false,
      structuralMatch: true,
    });
  });

  // PRUNING PHASE: Penalize structural orphans
  // If a node was purely structural (added via graph) but has no strong 
  // connections to OTHER high-confidence nodes, penalize it.
  const finalResults = combined.map(res => {
    const isOrphan = !allRefs.some(r => r.fromNodeId === res.nodeId || r.toNodeId === res.nodeId);
    if (res.structuralMatch && isOrphan) {
      return { ...res, similarity: res.similarity * 0.5 }; // 50% penalty for orphans
    }
    return res;
  });

  return finalResults.sort((a, b) => b.similarity - a.similarity).slice(0, 20);
}
