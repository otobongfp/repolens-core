import {
  tokenizeRequirement,
  tokenOverlapCount,
  tokenizeCode,
  structuralOverlap,
  STRUCTURAL_STOPWORDS,
} from './structural-tokens.util';

describe('structural-tokens.util', () => {
  describe('tokenizeRequirement', () => {
    it('lowercases and splits on non-alphanumeric', () => {
      const tokens = tokenizeRequirement('The system shall process payments');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('shall');
      expect(tokens).not.toContain('system'); // system is stopword
      expect(tokens).toContain('process');
      expect(tokens).toContain('payments');
    });

    it('removes stopwords', () => {
      expect(STRUCTURAL_STOPWORDS.has('the')).toBe(true);
      expect(STRUCTURAL_STOPWORDS.has('shall')).toBe(true);
      expect(STRUCTURAL_STOPWORDS.has('to')).toBe(true);
      const tokens = tokenizeRequirement('the user shall be able to login');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('shall');
      expect(tokens).not.toContain('to');
      expect(tokens).not.toContain('be');
      expect(tokens).toContain('user');
      expect(tokens).toContain('able');
      expect(tokens).toContain('login');
    });

    it('filters tokens of length <= 1', () => {
      const tokens = tokenizeRequirement('a b c process');
      expect(tokens.filter((t) => t.length <= 1)).toHaveLength(0);
      expect(tokens).toContain('process');
    });

    it('with stem option normalizes suffixes', () => {
      const tokens = tokenizeRequirement('processing payment validated', { stem: true });
      expect(tokens.some((t) => t === 'process' || t === 'processing')).toBe(true);
      expect(tokens).toContain('payment');
    });

    it('returns empty array for empty or stopword-only text', () => {
      expect(tokenizeRequirement('')).toEqual([]);
      expect(tokenizeRequirement('the and the')).toEqual([]);
    });
  });

  describe('tokenOverlapCount', () => {
    it('counts tokens that appear in target', () => {
      const tokens = ['payment', 'process', 'user'];
      expect(tokenOverlapCount(tokens, 'processPayment')).toBe(2);
      expect(tokenOverlapCount(tokens, 'handlePayment')).toBe(1);
      expect(tokenOverlapCount(tokens, 'unknown')).toBe(0);
    });

    it('is case-insensitive', () => {
      const tokens = ['Payment'];
      expect(tokenOverlapCount(tokens, 'PAYMENT')).toBe(1);
      expect(tokenOverlapCount(tokens, 'payment')).toBe(1);
    });

    it('returns 0 for empty target', () => {
      expect(tokenOverlapCount(['payment'], '')).toBe(0);
    });
  });

  describe('tokenizeCode', () => {
    it('lowercases and splits on non-alphanumeric', () => {
      expect(tokenizeCode('processPayment')).toEqual(['processpayment']);
      expect(tokenizeCode('src/auth/login.ts')).toContain('src');
      expect(tokenizeCode('src/auth/login.ts')).toContain('auth');
    });
  });

  describe('structuralOverlap', () => {
    it('overlap(r,c) = |Tokens_r ∩ Tokens_c| / |Tokens_r|', () => {
      const reqTokens = ['payment', 'process', 'user'];
      const name = tokenizeCode('processPayment');
      const path = tokenizeCode('src/payment/handler');
      const file = tokenizeCode('payment.ts');
      const overlap = structuralOverlap(reqTokens, name, path, file);
      expect(overlap).toBeGreaterThan(0);
      expect(overlap).toBeLessThanOrEqual(1);
      expect(overlap).toBe(1 / 3);
    });

    it('returns 0 when requirement tokens empty', () => {
      expect(structuralOverlap([], ['pay'], ['pay'], [])).toBe(0);
    });
  });
});
