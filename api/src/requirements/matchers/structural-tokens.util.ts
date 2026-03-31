/** Stopwords for requirement/text tokenization (structural and symbol matching). */
export const STRUCTURAL_STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'his',
  'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'has',
  'him', 'our', 'out', 'own', 'say', 'she', 'too', 'use', 'shall', 'system', 'that',
  'this', 'with', 'from', 'have', 'been', 'will', 'when', 'where', 'what', 'which',
  'into', 'over', 'some', 'than', 'them', 'then', 'they', 'more', 'only', 'other',
  'to', 'be',
]);

/** Simple stem: trim common suffixes for overlap (optional). */
function stem(t: string): string {
  if (t.length <= 4) return t;
  if (t.endsWith('ing') && t.length > 5) return t.slice(0, -3);
  if (t.endsWith('ed') && t.length > 4) return t.slice(0, -2);
  if (t.endsWith('s') && t.length > 3 && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

/**
 * Tokenize requirement text: lowercase, remove stopwords, split on non-alphanumeric.
 * Optionally apply simple stemming for better overlap.
 */
export function tokenizeRequirement(
  text: string,
  options: { stem?: boolean } = {}
): string[] {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(/\W+/)
    .filter((t) => t.length > 1 && !STRUCTURAL_STOPWORDS.has(t))
    .map((t) => (options.stem ? stem(t) : t));
}

/**
 * Count how many requirement tokens appear in a single target string (e.g. symbol name, path).
 */
export function tokenOverlapCount(requirementTokens: string[], target: string): number {
  if (!target) return 0;
  const lower = target.toLowerCase();
  let count = 0;
  for (const t of requirementTokens) {
    if (t.length > 1 && lower.includes(t.toLowerCase())) count++;
  }
  return count;
}

/** Tokenize code-side text (name, path): lowercase, split on non-alphanumeric, length > 1. No stopwords. */
export function tokenizeCode(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 1);
}

/**
 * Structural overlap: overlap(r,c) = |Tokens_r ∩ Tokens_c| / |Tokens_r|.
 * Tokens_c = union of tokens from symbol name, nodePath, filePath, and optionally signature(s).
 */
export function structuralOverlap(
  requirementTokens: string[],
  tokensFromName: string[],
  tokensFromNodePath: string[],
  tokensFromFilePath: string[],
  tokensFromSignature: string[] = []
): number {
  if (requirementTokens.length === 0) return 0;
  const reqSet = new Set(requirementTokens.map((t) => t.toLowerCase()));
  const codeSet = new Set<string>();
  [...tokensFromName, ...tokensFromNodePath, ...tokensFromFilePath, ...tokensFromSignature].forEach(
    (t) => codeSet.add(t.toLowerCase())
  );
  let intersection = 0;
  reqSet.forEach((t) => {
    if (codeSet.has(t)) intersection++;
  });
  return Math.min(1, intersection / requirementTokens.length);
}
