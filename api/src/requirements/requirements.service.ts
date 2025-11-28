import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { TensorService } from '../common/tensor/tensor.service';
import { SearchService } from '../search/search.service';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
}

@Injectable()
export class RequirementsService {
  private readonly logger = new Logger(RequirementsService.name);
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000; // 1 second

  constructor(
    private readonly prisma: PrismaService,
    private readonly tensor: TensorService,
    private readonly search: SearchService
  ) {}

  /**
   * Retry wrapper with exponential backoff for fault tolerance
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
    context: string
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.DEFAULT_MAX_RETRIES;
    const retryDelay = options.retryDelay ?? this.DEFAULT_RETRY_DELAY;
    const exponentialBackoff = options.exponentialBackoff ?? true;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delay = exponentialBackoff ? retryDelay * Math.pow(2, attempt) : retryDelay;

          this.logger.warn(
            `${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
            lastError.message
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          this.logger.error(`${context} failed after ${maxRetries + 1} attempts:`, lastError);
        }
      }
    }

    throw lastError || new Error(`${context} failed after ${maxRetries + 1} attempts`);
  }

  /**
   * Extract requirements from document with robust error handling
   */
  async extractRequirements(documentContent: string, projectId?: string) {
    this.logger.log(`Extracting requirements for project ${projectId}`);

    if (!documentContent || documentContent.trim().length === 0) {
      throw new Error('Document content is required');
    }

    try {
      // Use Tensor service to extract requirements from document with retry
      const extractionPrompt = `Extract requirements from the following document. 
For each requirement, provide:
1. A clear title (max 10 words)
2. The requirement text
3. Whether it's a feature requirement or a suggestion
4. Priority level (high, medium, low)
5. Estimated complexity (simple, moderate, complex)

Document:
${documentContent.substring(0, 10000)}${documentContent.length > 10000 ? '...' : ''}

Format as JSON array with: {title, text, type: "feature"|"suggestion", priority: "high"|"medium"|"low", complexity: "simple"|"moderate"|"complex"}`;

      const chatResponse = await this.withRetry(
        () =>
          this.tensor.chat([
            {
              role: 'system',
              content:
                'You are a requirements extraction assistant. Extract requirements from documents and format them as JSON. Be precise and factual.',
            },
            { role: 'user', content: extractionPrompt },
          ]),
        { maxRetries: 3, exponentialBackoff: true },
        'Requirements extraction'
      );

      // Parse extracted requirements with robust error handling
      let extractedRequirements: Array<{
        title: string;
        text: string;
        type: 'feature' | 'suggestion';
        priority?: 'high' | 'medium' | 'low';
        complexity?: 'simple' | 'moderate' | 'complex';
      }> = [];

      try {
        const responseText = chatResponse.content || JSON.stringify(chatResponse);

        // Try multiple JSON extraction strategies
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedRequirements = JSON.parse(jsonMatch[0]);
        } else if (responseText.trim().startsWith('[')) {
          extractedRequirements = JSON.parse(responseText);
        } else {
          // Fallback: try to extract from markdown code blocks
          const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
          if (codeBlockMatch) {
            extractedRequirements = JSON.parse(codeBlockMatch[1]);
          }
        }

        // Validate extracted requirements
        if (!Array.isArray(extractedRequirements) || extractedRequirements.length === 0) {
          throw new Error('No requirements extracted');
        }

        // Validate each requirement has required fields
        extractedRequirements = extractedRequirements.filter(
          (req) => req.title && req.text && req.type
        );
      } catch (parseError) {
        this.logger.warn('Failed to parse extracted requirements, using fallback', parseError);
        // Fallback: create single requirement from document
        extractedRequirements = [
          {
            title: 'Extracted Requirement',
            text: documentContent.substring(0, 500),
            type: 'feature' as const,
            priority: 'medium' as const,
            complexity: 'moderate' as const,
          },
        ];
      }

      // Create requirement records with transaction for atomicity
      const requirements = await this.prisma.$transaction(
        async (tx) => {
          return Promise.all(
            extractedRequirements.map((req) =>
              tx.requirement.create({
                data: {
                  title: req.title.substring(0, 200), // Enforce length limits
                  text: req.text.substring(0, 10000),
                  type: req.type || 'feature',
                  status: req.type === 'suggestion' ? 'pending' : 'accepted',
                  projectId: projectId || null,
                  confidence: 'medium',
                  // Store metadata in a JSON field if needed
                },
              })
            )
          );
        },
        {
          timeout: 30000, // 30 second timeout
        }
      );

      // Generate embeddings for requirements with error handling
      const embeddingPromises = requirements.map(async (req) => {
        try {
          const embedResponse = await this.withRetry(
            () => this.tensor.embed([req.text]),
            { maxRetries: 2 },
            `Embedding generation for requirement ${req.id}`
          );

          if (embedResponse.vectors && embedResponse.vectors.length > 0) {
            await this.prisma.requirement.update({
              where: { id: req.id },
              data: {
                vectorId: `req_${req.id}_${Date.now()}`,
              },
            });
          }
        } catch (embedError) {
          this.logger.warn(`Failed to embed requirement ${req.id}:`, embedError);
          // Continue processing other requirements even if one fails
        }
      });

      // Wait for all embeddings, but don't fail if some fail
      await Promise.allSettled(embeddingPromises);

      return {
        message: `Extracted ${requirements.length} requirement(s)`,
        requirementId: requirements[0]?.id,
        requirements: requirements.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          status: r.status,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to extract requirements:', error);

      // Last resort fallback: create single requirement
      try {
        const requirement = await this.prisma.requirement.create({
          data: {
            title: 'Extracted Requirement',
            text: documentContent.substring(0, 10000),
            type: 'feature',
            status: 'accepted',
            projectId: projectId || null,
            confidence: 'low',
          },
        });

        return {
          message: 'Requirements extraction completed (fallback mode)',
          requirementId: requirement.id,
          requirements: [requirement],
          warning: 'Extraction used fallback mode due to errors',
        };
      } catch (fallbackError) {
        this.logger.error('Fallback requirement creation also failed:', fallbackError);
        throw new Error(
          'Failed to extract requirements: ' +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }
  }

  /**
   * Match requirements to code with comprehensive error handling
   */
  async matchRequirements(requirementId: string, projectId?: string) {
    this.logger.log(`Matching requirement ${requirementId} for project ${projectId}`);

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    try {
      // Get project repositories to find matching code
      let repoIds: string[] = [];

      if (projectId) {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          include: { repositories: true },
        });

        if (project) {
          const allRepos = await this.prisma.repo.findMany({
            where:
              project.repositories.length > 0
                ? {
                    url: {
                      in: project.repositories
                        .map((r) => r.url)
                        .filter((url) => url !== null) as string[],
                    },
                  }
                : {},
          });
          repoIds = allRepos.map((r) => r.id);
        }
      } else if (requirement.repoId) {
        repoIds = [requirement.repoId];
      }

      if (repoIds.length === 0) {
        return {
          message: 'No repositories found for matching',
          requirementId,
          matches: [],
        };
      }

      // Get or generate embedding for requirement
      let requirementEmbedding: number[] | null = null;

      if (requirement.vectorId) {
        requirementEmbedding = await this.getRequirementEmbedding(requirement.id);
      }

      if (!requirementEmbedding) {
        // Generate embedding with retry
        const embedResponse = await this.withRetry(
          () => this.tensor.embed([requirement.text]),
          { maxRetries: 2 },
          'Requirement embedding generation'
        );

        if (embedResponse.vectors && embedResponse.vectors.length > 0) {
          requirementEmbedding = embedResponse.vectors[0];
          await this.prisma.requirement.update({
            where: { id: requirement.id },
            data: { vectorId: `req_${requirement.id}_${Date.now()}` },
          });
        }
      }

      // Search for matching code nodes using semantic similarity
      const matchingNodes = await this.findMatchingNodes(
        requirement.text,
        requirementEmbedding,
        repoIds
      );

      // Create RequirementMatch records with transaction
      const matches = await this.prisma.$transaction(
        async (tx) => {
          return Promise.all(
            matchingNodes.map(async (node) => {
              const matchScore = node.similarity || 0.5;
              const matchTypes: string[] = [];

              // Determine match types
              if (node.symbolMatch) matchTypes.push('symbol');
              if (matchScore > 0.7) matchTypes.push('semantic');
              if (node.structuralMatch) matchTypes.push('structural');

              const confidence = matchScore > 0.8 ? 'high' : matchScore > 0.6 ? 'medium' : 'low';

              return tx.requirementMatch.upsert({
                where: {
                  requirementId_nodeId: {
                    requirementId: requirement.id,
                    nodeId: node.nodeId,
                  },
                },
                create: {
                  requirementId: requirement.id,
                  nodeId: node.nodeId,
                  matchScore,
                  matchTypes,
                  confidence,
                },
                update: {
                  matchScore,
                  matchTypes,
                  confidence,
                  updatedAt: new Date(),
                },
              });
            })
          );
        },
        { timeout: 30000 }
      );

      return {
        message: `Found ${matches.length} matching code sections`,
        requirementId,
        matches: matches.map((m) => ({
          id: m.id,
          nodeId: m.nodeId,
          matchScore: m.matchScore,
          matchTypes: m.matchTypes,
          confidence: m.confidence,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to match requirements:', error);
      return {
        message: 'Requirement matching failed',
        requirementId,
        matches: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Find matching nodes using semantic vector search
   */
  private async findMatchingNodes(
    requirementText: string,
    requirementEmbedding: number[] | null,
    repoIds: string[]
  ): Promise<
    Array<{
      nodeId: string;
      similarity: number;
      symbolMatch?: boolean;
      structuralMatch?: boolean;
    }>
  > {
    try {
      // Use semantic search for each repo
      const allMatches: Array<{
        id: string;
        similarity: number;
        filePath: string;
        summary: string | null;
        chunkText: string;
      }> = [];

      // Search across all repos
      for (const repoId of repoIds) {
        try {
          const results = await this.search.semanticSearch(
            requirementText,
            repoId,
            10, // Top 10 per repo
            0.5 // Lower threshold to get more results
          );
          allMatches.push(...results);
        } catch (error) {
          this.logger.warn(`Semantic search failed for repo ${repoId}, skipping:`, error);
      }
    }

      // If no vector search results, fallback to basic search
      if (allMatches.length === 0) {
        this.logger.warn('No semantic search results, falling back to basic search');
    const embeddings = await this.prisma.embedding.findMany({
      where: repoIds.length > 0 ? { repoId: { in: repoIds } } : {},
      include: { node: true },
          take: 100,
    });

        return embeddings
      .map((emb) => {
            const similarity = this.calculateTextSimilarity(
            requirementText,
            emb.summary || emb.chunkText || ''
          );
        return {
          nodeId: emb.nodeId || '',
          similarity,
          symbolMatch: this.checkSymbolMatch(requirementText, emb),
          structuralMatch: false,
        };
      })
          .filter((s) => s.similarity > 0.3 && s.nodeId)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 20);
      }

      // Get full embedding records with nodes
      const embeddingIds = allMatches.map((m) => m.id);
      const embeddings = await this.prisma.embedding.findMany({
        where: { id: { in: embeddingIds } },
        include: { node: true },
      });

      // Map to node results
      const nodeMatches = allMatches
        .map((match) => {
          const embedding = embeddings.find((e) => e.id === match.id);
          if (!embedding || !embedding.nodeId) {
            return null;
          }

          return {
            nodeId: embedding.nodeId,
            similarity: match.similarity,
            symbolMatch: this.checkSymbolMatch(requirementText, embedding),
            structuralMatch: false,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20); // Top 20 matches

      return nodeMatches;
    } catch (error) {
      this.logger.error('Failed to find matching nodes:', error);
      // Fallback to empty array
      return [];
    }
  }

  /**
   * Improved text similarity calculation (Jaccard + word overlap)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2)
    );
    const words2 = new Set(
      text2
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2)
    );

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private checkSymbolMatch(requirementText: string, embedding: any): boolean {
    const requirementWords = requirementText
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    const codeText = (embedding.summary || embedding.chunkText || '').toLowerCase();

    return requirementWords.some((word) => codeText.includes(word));
  }

  private async getRequirementEmbedding(requirementId: string): Promise<number[] | null> {
    return null;
  }

  async verifyMatch(matchId: string, status: string) {
    const match = await this.prisma.requirementMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const updatedMatch = await this.prisma.requirementMatch.update({
      where: { id: matchId },
      data: {
        matchTypes: match.matchTypes.includes('verified')
          ? match.matchTypes
          : [...match.matchTypes, 'verified'],
        confidence: status === 'verified' ? 'high' : match.confidence,
        verificationTrace: {
          verified: status === 'verified',
          verifiedAt: new Date().toISOString(),
        },
      },
    });

    return {
      message: 'Match verification updated',
      matchId: updatedMatch.id,
      status,
    };
  }

  /**
   * Get project requirements with comprehensive completion tracking
   */
  async getProjectRequirements(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: true,
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Get requirements linked to project
    const requirements = await this.prisma.requirement.findMany({
      where: {
        projectId: projectId,
      },
      include: {
        requirementMatches: {
          include: {
            node: {
              include: {
                repo: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate comprehensive completion metrics
    const completionMetrics = this.calculateCompletionMetrics(requirements);

    return {
      requirements: requirements.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        matchCount: r.requirementMatches.length,
        completionPercentage: this.calculateRequirementCompletion(r),
      })),
      count: requirements.length,
      completionMetrics,
    };
  }

  /**
   * Calculate completion metrics for a set of requirements
   */
  private calculateCompletionMetrics(requirements: any[]) {
    if (requirements.length === 0) {
      return {
        overallCompletion: 0,
        acceptedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        fullyImplemented: 0,
        partiallyImplemented: 0,
        notImplemented: 0,
      };
    }

    const acceptedRequirements = requirements.filter(
      (r) => r.status === 'accepted' || r.type === 'feature'
    );

    let fullyImplemented = 0;
    let partiallyImplemented = 0;
    let notImplemented = 0;

    for (const req of acceptedRequirements) {
      const completion = this.calculateRequirementCompletion(req);
      if (completion >= 80) {
        fullyImplemented++;
      } else if (completion > 0) {
        partiallyImplemented++;
      } else {
        notImplemented++;
      }
    }

    const overallCompletion = this.calculateCompletionPercentage(requirements);

    return {
      overallCompletion,
      acceptedCount: acceptedRequirements.length,
      pendingCount: requirements.filter((r) => r.status === 'pending').length,
      rejectedCount: requirements.filter((r) => r.status === 'rejected').length,
      fullyImplemented,
      partiallyImplemented,
      notImplemented,
      totalRequirements: requirements.length,
    };
  }

  /**
   * Calculate completion percentage for a single requirement
   */
  private calculateRequirementCompletion(requirement: any): number {
    const matches = requirement.requirementMatches || [];

    if (matches.length === 0) return 0;

    // Average match score weighted by confidence
    const weightedSum = matches.reduce((sum: number, m: any) => {
      const weight = m.confidence === 'high' ? 1.0 : m.confidence === 'medium' ? 0.7 : 0.4;
      return sum + m.matchScore * weight;
    }, 0);

    const totalWeight = matches.reduce((sum: number, m: any) => {
      return sum + (m.confidence === 'high' ? 1.0 : m.confidence === 'medium' ? 0.7 : 0.4);
    }, 0);

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
  }

  async updateRequirementStatus(requirementId: string, status: 'accepted' | 'rejected') {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    const updated = await this.prisma.requirement.update({
      where: { id: requirementId },
      data: { status },
    });

    return {
      message: `Requirement ${status}`,
      requirement: updated,
    };
  }

  private calculateCompletionPercentage(requirements: any[]): number {
    if (requirements.length === 0) return 0;

    const acceptedRequirements = requirements.filter(
      (r) => r.status === 'accepted' || r.type === 'feature'
    );

    if (acceptedRequirements.length === 0) return 0;

    let totalCompletion = 0;
    for (const req of acceptedRequirements) {
      totalCompletion += this.calculateRequirementCompletion(req);
    }

    return Math.round(totalCompletion / acceptedRequirements.length);
  }
}
