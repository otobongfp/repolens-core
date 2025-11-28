import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SearchService } from '../../search/search.service';
import { CitationService, Citation } from '../citation/citation.service';

export interface HallucinationCheck {
  isHallucination: boolean;
  confidence: number; // 0-1, higher = more confident it's a hallucination
  reasons: string[];
  suggestedSources: Citation[];
}

@Injectable()
export class HallucinationDetectionService {
  private readonly logger = new Logger(HallucinationDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SearchService))
    private readonly search: SearchService,
    private readonly citation: CitationService
  ) {}

  /**
   * Detect hallucinations in AI response by checking against source code
   */
  async detectHallucination(
    response: string,
    repoId?: string,
    query?: string
  ): Promise<HallucinationCheck> {
    const reasons: string[] = [];
    let confidence = 0;

    // Extract potential code references, function names, file paths from response
    const codePatterns = this.extractCodePatterns(response);
    
    // Extract claims that might need verification
    const claims = this.extractClaims(response);

    // Check if response contains unsupported claims
    if (claims.length === 0 && codePatterns.length === 0) {
      // No verifiable content - might be generic response
      reasons.push('Response contains no verifiable code references or specific claims');
      confidence += 0.2;
    }

    // Search for code patterns in the codebase
    const verificationResults: Array<{ pattern: string; found: boolean; citations: Citation[] }> = [];

    for (const pattern of codePatterns) {
      try {
        const searchResults = await this.search.semanticSearch(
          pattern,
          repoId,
          5,
          0.5 // Lower threshold for verification
        );

        const citations = await this.citation.enhanceWithCitations(searchResults);
        const found = citations.length > 0 && citations.some(c => c.similarity > 0.6);

        verificationResults.push({
          pattern,
          found,
          citations,
        });

        if (!found) {
          reasons.push(`Code pattern "${pattern}" not found in codebase`);
          confidence += 0.3;
        }
      } catch (error) {
        this.logger.warn(`Failed to verify pattern "${pattern}":`, error);
      }
    }

    // Check claims against codebase
    for (const claim of claims) {
      try {
        const searchResults = await this.search.semanticSearch(
          claim,
          repoId,
          5,
          0.5
        );

        const citations = await this.citation.enhanceWithCitations(searchResults);
        const found = citations.length > 0 && citations.some(c => c.similarity > 0.6);

        if (!found) {
          reasons.push(`Claim "${claim.substring(0, 50)}..." not supported by codebase`);
          confidence += 0.2;
        }
      } catch (error) {
        this.logger.warn(`Failed to verify claim:`, error);
      }
    }

    // Check for common hallucination indicators
    if (this.hasHallucinationIndicators(response)) {
      reasons.push('Response contains common hallucination indicators');
      confidence += 0.2;
    }

    // Collect all suggested sources
    const suggestedSources: Citation[] = [];
    for (const result of verificationResults) {
      suggestedSources.push(...result.citations);
    }

    // Remove duplicates
    const uniqueSources = Array.from(
      new Map(suggestedSources.map(c => [c.id, c])).values()
    );

    // Normalize confidence to 0-1
    confidence = Math.min(confidence, 1.0);

    return {
      isHallucination: confidence > 0.5,
      confidence,
      reasons,
      suggestedSources: uniqueSources.slice(0, 5), // Top 5 sources
    };
  }

  /**
   * Extract code patterns from response (function names, class names, file paths)
   */
  private extractCodePatterns(response: string): string[] {
    const patterns: string[] = [];

    // Function names (camelCase, snake_case, PascalCase)
    const functionPattern = /\b([a-z][a-zA-Z0-9]*|_[a-z][a-zA-Z0-9]*|[A-Z][a-zA-Z0-9]*)\s*\(/g;
    let match;
    while ((match = functionPattern.exec(response)) !== null) {
      if (match[1].length > 2 && match[1].length < 50) {
        patterns.push(match[1]);
      }
    }

    // File paths
    const pathPattern = /([a-zA-Z0-9_\-./]+\.(js|ts|py|rs|go|rb|java|cs|cpp|c|h|hpp|tsx|jsx))/g;
    while ((match = pathPattern.exec(response)) !== null) {
      patterns.push(match[1]);
    }

    // Class names (PascalCase)
    const classPattern = /\b([A-Z][a-zA-Z0-9]+)\b/g;
    while ((match = classPattern.exec(response)) !== null) {
      if (match[1].length > 2 && match[1].length < 50) {
        patterns.push(match[1]);
      }
    }

    // Remove duplicates and common words
    const commonWords = new Set(['the', 'and', 'or', 'but', 'for', 'with', 'from', 'this', 'that']);
    return Array.from(new Set(patterns)).filter(p => !commonWords.has(p.toLowerCase()));
  }

  /**
   * Extract verifiable claims from response
   */
  private extractClaims(response: string): string[] {
    const claims: string[] = [];

    // Look for statements about code behavior
    const claimPatterns = [
      /(?:function|class|method|file)\s+([a-zA-Z0-9_]+)\s+(?:does|performs|handles|implements|contains)/gi,
      /(?:the|this)\s+([a-zA-Z0-9_]+)\s+(?:function|class|method)\s+(?:does|performs|handles)/gi,
    ];

    for (const pattern of claimPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        if (match[1]) {
          claims.push(match[1]);
        }
      }
    }

    return Array.from(new Set(claims));
  }

  /**
   * Check for common hallucination indicators
   */
  private hasHallucinationIndicators(response: string): boolean {
    const indicators = [
      /I (?:don't|do not) have (?:access|information)/i,
      /I (?:cannot|cannot) (?:access|find|locate)/i,
      /(?:without|missing) (?:context|information|details)/i,
      /(?:assume|assuming|probably|likely|might|may) (?:that|it|this)/i,
    ];

    return indicators.some(pattern => pattern.test(response));
  }

  /**
   * Validate response against specific code snippet
   */
  async validateAgainstCode(
    response: string,
    codeSnippet: string,
    filePath: string
  ): Promise<{ isValid: boolean; confidence: number; issues: string[] }> {
    const issues: string[] = [];
    let confidence = 1.0;

    // Check if response mentions code that doesn't exist in snippet
    const codeFunctions = this.extractCodePatterns(codeSnippet);
    const responseFunctions = this.extractCodePatterns(response);

    for (const func of responseFunctions) {
      if (!codeFunctions.some(cf => cf.toLowerCase() === func.toLowerCase())) {
        issues.push(`Response mentions "${func}" which is not in the provided code`);
        confidence -= 0.2;
      }
    }

    // Check for contradictions
    if (this.hasContradictions(response, codeSnippet)) {
      issues.push('Response contains contradictions with the provided code');
      confidence -= 0.3;
    }

    return {
      isValid: confidence > 0.7,
      confidence: Math.max(0, confidence),
      issues,
    };
  }

  /**
   * Check for contradictions between response and code
   */
  private hasContradictions(response: string, code: string): boolean {
    const missingPatterns = [
      /(?:missing|doesn't have|does not have|lacks)\s+([a-zA-Z0-9_]+)/gi,
    ];

    for (const pattern of missingPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        const mentioned = match[1].toLowerCase();
        if (code.toLowerCase().includes(mentioned)) {
          return true;
        }
      }
    }

    return false;
  }
}

