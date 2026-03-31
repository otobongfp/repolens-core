/**
 * Four matchers (same project scope; only method differs):
 * - tfidf: bag-of-words, TF-IDF, cosine similarity
 * - embedding: LLM embeddings, cosine similarity
 * - structural-only: symbol/path overlap + graph propagation
 * - hybrid: embeddings + symbol match + graph (full system)
 */
export type MatcherType =
  | 'hybrid'
  | 'embedding'
  | 'tfidf'
  | 'structural-only';

export interface MatchResult {
  nodeId: string;
  similarity: number;
  symbolMatch?: boolean;
  structuralMatch?: boolean;
}

/** Minimal requirement shape needed by matchers */
export interface RequirementForMatch {
  id: string;
  text: string;
  vector?: number[];
  projectId?: string | null;
}

/** Optional flags for ablation (experiment config). Matchers may ignore. */
export interface ExperimentMatchOptions {
  useGraphPropagation?: boolean;
  useSymbolMatching?: boolean;
}

export interface MatcherStrategy {
  readonly matcherType: MatcherType;
  match(
    requirement: RequirementForMatch,
    projectId: string,
    options?: ExperimentMatchOptions
  ): Promise<MatchResult[]>;
}

/** Configuration for a single experiment run (evaluation mode). */
export interface TraceabilityExperimentConfig {
  matcherType: MatcherType;
  threshold: number;
  useGraphPropagation: boolean;
  useSymbolMatching: boolean;
}
