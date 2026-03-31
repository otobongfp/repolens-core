import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { getProjectCodeScopeRepoIds } from './project-scope.util';
import type {
  MatcherStrategy,
  MatchResult,
  RequirementForMatch,
  ExperimentMatchOptions,
} from './types';

/**
 * Tokenize text into lowercase words for TF-IDF.
 * Splits on non-words, camelCase and snake_case so requirement prose and code identifiers
 * share tokens (e.g. "reset password" and "resetPassword" both yield ["reset", "password"]).
 */
function tokenize(text: string): string[] {
  const withSpaces = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ');
  return withSpaces
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(/\W+/)
    .filter((t) => t.length > 1);
}

/** Term frequency map: raw count f(t,d) */
function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) {
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

/** TF(t,d) = f(t,d) / |d| per spec; |d| = total terms in document */
function tfNormalized(tf: Map<string, number>, docLength: number): Map<string, number> {
  const out = new Map<string, number>();
  if (docLength === 0) {
    tf.forEach((_, t) => out.set(t, 0));
    return out;
  }
  tf.forEach((count, t) => out.set(t, count / docLength));
  return out;
}

/** Cosine similarity in [0,1] for non-negative TF-IDF vectors: dot(a,b) / (||a|| * ||b||) */
function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>,
  terms: string[]
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const t of terms) {
    const a = vecA.get(t) ?? 0;
    const b = vecB.get(t) ?? 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

@Injectable()
export class TfidfMatcher implements MatcherStrategy {
  readonly matcherType = 'tfidf' as const;
  private readonly logger = new Logger(TfidfMatcher.name);

  constructor(private readonly prisma: PrismaService) {}

  async match(
    requirement: RequirementForMatch,
    projectId: string,
    _options?: ExperimentMatchOptions
  ): Promise<MatchResult[]> {
    const repoIds = await getProjectCodeScopeRepoIds(this.prisma, projectId);
    if (repoIds.length === 0) {
      this.logger.debug(`TF-IDF matcher: no code scope for project ${projectId}.`);
      return [];
    }

    const nodes = await this.prisma.node.findMany({
      where: { repoId: { in: repoIds } },
      select: {
        id: true,
        summary: true,
        text: true,
        signature: true,
        symbol: { select: { name: true } },
      },
    });

    if (nodes.length === 0) return [];

    const docs = nodes.map((n) => {
      const parts = [n.summary, n.text, n.signature, n.symbol?.name].filter(Boolean) as string[];
      const text = parts.join(' ').trim() || '(empty)';
      return { nodeId: n.id, text };
    });

    const docTokens = docs.map((d) => tokenize(d.text));
    const vocabulary = new Set<string>();
    docTokens.forEach((tokens) => tokens.forEach((t) => vocabulary.add(t)));
    const terms = Array.from(vocabulary);
    if (terms.length === 0) {
      this.logger.debug(`TF-IDF matcher: empty vocabulary for project ${projectId} (node text/summary empty?).`);
      return [];
    }

    const N = docs.length;
    const df = new Map<string, number>();
    for (const t of terms) {
      let count = 0;
      for (const tokens of docTokens) {
        if (tokens.includes(t)) count++;
      }
      df.set(t, count);
    }

    // IDF(t) = log(N / df(t)); guard df=0
    const idf = new Map<string, number>();
    for (const t of terms) {
      const dft = df.get(t) ?? 1;
      idf.set(t, Math.log(N / dft));
    }

    const docTfidf = docTokens.map((tokens) => {
      const tf = termFreq(tokens);
      const tfNorm = tfNormalized(tf, tokens.length);
      const vec = new Map<string, number>();
      for (const t of terms) {
        const tfVal = tfNorm.get(t) ?? 0;
        vec.set(t, tfVal * (idf.get(t) ?? 0));
      }
      return vec;
    });

    const reqTokens = tokenize(requirement.text);
    const reqTf = termFreq(reqTokens);
    const reqTfNorm = tfNormalized(reqTf, reqTokens.length);
    const reqTfidf = new Map<string, number>();
    for (const t of terms) {
      const tfVal = reqTfNorm.get(t) ?? 0;
      reqTfidf.set(t, tfVal * (idf.get(t) ?? 0));
    }

    const scored = docs.map((d, i) => ({
      nodeId: d.nodeId,
      similarity: cosineSimilarity(reqTfidf, docTfidf[i], terms),
    }));

    const withScore = scored.filter((s) => s.similarity > 0);
    if (withScore.length === 0) {
      this.logger.debug(
        `TF-IDF matcher: no term overlap for this requirement (vocabulary ${terms.length} terms). Tokenizer splits camelCase/snake_case so code and requirements can share tokens.`
      );
    }
    return withScore
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20)
      .map((s) => ({
        nodeId: s.nodeId,
        similarity: Math.round(s.similarity * 10000) / 10000,
        symbolMatch: false,
        structuralMatch: false,
      }));
  }

}
