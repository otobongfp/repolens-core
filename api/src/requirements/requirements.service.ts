import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { TensorService } from '../common/tensor/tensor.service';
import { SearchService } from '../search/search.service';
import { QueueService } from '../common/queue/queue.service';
import {
  HybridMatcher,
  EmbeddingOnlyMatcher,
  TfidfMatcher,
  StructuralOnlyMatcher,
  type MatcherType,
  type MatcherStrategy,
  type ExperimentMatchOptions,
} from './matchers';
import * as mammoth from 'mammoth';
import { REQUIREMENTS_SYSTEM_PROMPT, getRequirementsExtractionPrompt } from '../common/prompts';

const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.PDFParse || pdfParseModule;

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
}

@Injectable()
export class RequirementsService {
  private readonly logger = new Logger(RequirementsService.name);
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tensor: TensorService,
    private readonly search: SearchService,
    private readonly hybridMatcher: HybridMatcher,
    private readonly embeddingOnlyMatcher: EmbeddingOnlyMatcher,
    private readonly tfidfMatcher: TfidfMatcher,
    private readonly structuralOnlyMatcher: StructuralOnlyMatcher,
    private readonly queue: QueueService
  ) {}

  private getMatcher(matcherType: MatcherType): MatcherStrategy {
    switch (matcherType) {
      case 'embedding':
        return this.embeddingOnlyMatcher;
      case 'tfidf':
        return this.tfidfMatcher;
      case 'structural-only':
        return this.structuralOnlyMatcher;
      case 'hybrid':
      default:
        return this.hybridMatcher;
    }
  }

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
   * Extract text from uploaded file (PDF or DOCX)
   */
  async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    this.logger.log(`Extracting text from file: ${file.originalname} (${file.mimetype})`);

    try {
      if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
        const parser = new pdfParse({ data: file.buffer });
        const result = await parser.getText();
        this.logger.log(`Extracted ${result.text.length} characters from PDF`);
        return result.text;
      } else if (
        file.mimetype ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.originalname.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        this.logger.log(`Extracted ${result.value.length} characters from DOCX`);
        return result.value;
      } else if (
        file.mimetype === 'text/plain' ||
        file.originalname.endsWith('.txt') ||
        file.originalname.endsWith('.md')
      ) {
        return file.buffer.toString('utf-8');
      } else {
        throw new Error(
          `Unsupported file type: ${file.mimetype}. Supported types: PDF, DOCX, TXT, MD`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to extract text from file:`, error);
      throw new Error(
        `Failed to extract text from file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Extract requirements from document with robust error handling
   */
  async extractRequirements(
    documentContent: string,
    projectId?: string,
    options?: { autoMatch?: boolean; matcherType?: MatcherType }
  ) {
    this.logger.log(`Extracting requirements for project ${projectId}`);
    this.logger.debug(`Document content length: ${documentContent?.length || 0} characters`);
    this.logger.debug(`Document preview: ${documentContent?.substring(0, 200) || 'empty'}...`);

    if (!documentContent || documentContent.trim().length === 0) {
      throw new Error('Document content is required');
    }

    if (
      documentContent.includes('[File:') ||
      documentContent.includes('[PDF File:') ||
      documentContent.includes('[DOCX File:')
    ) {
      this.logger.warn('Document content appears to be a placeholder, not actual content');
      throw new Error(
        'Please provide the actual document content, not a file placeholder. Extract text from your file and paste it.'
      );
    }

    try {
      const extractionPrompt = getRequirementsExtractionPrompt(documentContent);

      const chatResponse = await this.withRetry(
        () =>
          this.tensor.chat([
            {
              role: 'system',
              content: REQUIREMENTS_SYSTEM_PROMPT,
            },
            { role: 'user', content: extractionPrompt },
          ]),
        { maxRetries: 3, exponentialBackoff: true },
        'Requirements extraction'
      );

      let extractedRequirements: Array<{
        title: string;
        text: string;
        type: 'feature' | 'suggestion';
        priority?: 'high' | 'medium' | 'low';
        complexity?: 'simple' | 'moderate' | 'complex';
      }> = [];

      try {
        const responseText = chatResponse.content || JSON.stringify(chatResponse);

        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedRequirements = JSON.parse(jsonMatch[0]);
        } else if (responseText.trim().startsWith('[')) {
          extractedRequirements = JSON.parse(responseText);
        } else {
          const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
          if (codeBlockMatch) {
            extractedRequirements = JSON.parse(codeBlockMatch[1]);
          }
        }

        // Validate extracted requirements
        if (!Array.isArray(extractedRequirements) || extractedRequirements.length === 0) {
          throw new Error('No requirements extracted');
        }

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
            const vector = embedResponse.vectors[0];
            await this.prisma.requirement.update({
              where: { id: req.id },
              data: {
                vectorId: `req_${req.id}_${Date.now()}`,
              },
            });
            // Persist the actual vector in the new column
            await this.prisma.storeVector(req.id, vector, 'Requirement');
          }
        } catch (embedError) {
          this.logger.warn(`Failed to embed requirement ${req.id}:`, embedError);
          // Continue processing other requirements even if one fails
        }
      });

      // Wait for all embeddings, but don't fail if some fail
      await Promise.allSettled(embeddingPromises);

      // Trigger auto-match in background if requested
      if (options?.autoMatch && projectId) {
        this.logger.log(`Enqueuing background match job for project ${projectId}`);
        await this.queue.enqueue('match-requirements', {
          projectId,
          matcherType: options.matcherType || 'hybrid',
        });
      }

      return {
        message: `Extracted ${requirements.length} requirement(s)${options?.autoMatch ? ' and enqueued background matching' : ''}`,
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
   * Match requirements to code with comprehensive error handling.
   * Uses the given matcher strategy (default hybrid). Matches are stored with matcherType
   * so different strategies do not overwrite each other.
   * Matching is independent of ground truth: GT is never read or used here; it is only used
   * during evaluation (metrics / threshold tuning / compare).
   */
  async matchRequirements(
    requirementId: string,
    projectId?: string,
    matcherType: MatcherType = 'hybrid',
    options?: ExperimentMatchOptions
  ) {
    this.logger.log(`Matching requirement ${requirementId} for project ${projectId} (matcher: ${matcherType})`);

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    const effectiveProjectId = projectId ?? requirement.projectId ?? undefined;
    if (!effectiveProjectId) {
      return {
        message: 'projectId is required for matching',
        requirementId,
        matches: [],
      };
    }

    try {
      const matcher = this.getMatcher(matcherType);

      // Check if requirement has a persistent vector
      let queryInput: string | number[] = requirement.text;
      try {
        const rawResult = await this.prisma.$queryRawUnsafe<Array<{ vector: string | null }>>(
          `SELECT vector::text FROM "Requirement" WHERE id = $1`,
          requirement.id
        );
        const vectorStr = rawResult[0]?.vector;
        if (vectorStr) {
          // Parse pgvector string format "[1.2, 3.4, ...]"
          queryInput = vectorStr
            .replace(/[\[\]]/g, '')
            .split(',')
            .map(Number);
          this.logger.debug(`Reusing persisted vector for requirement ${requirement.id}`);
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch persisted vector for requirement ${requirement.id}, falling back to text`, err);
      }

      const matchingNodes = await matcher.match(
        {
          id: requirement.id,
          text: requirement.text,
          vector: Array.isArray(queryInput) ? queryInput : undefined,
          projectId: requirement.projectId,
        },
        effectiveProjectId,
        options
      );

      const matches = await this.prisma.$transaction(
        async (tx) => {
          return Promise.all(
            matchingNodes.map(async (node) => {
              // Preserve legitimate 0.0 scores (do not coerce to fallback).
              // Normalize to [0,1] so metric thresholds are comparable across matchers.
              const rawScore =
                typeof node.similarity === 'number' && Number.isFinite(node.similarity)
                  ? node.similarity
                  : 0;
              const matchScore = Math.max(0, Math.min(1, rawScore));
              const matchTypes: string[] = [];
              if (node.symbolMatch) matchTypes.push('symbol');
              if (matchScore > 0.7) matchTypes.push('semantic');
              if (node.structuralMatch) matchTypes.push('structural');

              const confidence = matchScore > 0.8 ? 'high' : matchScore > 0.6 ? 'medium' : 'low';

              return tx.requirementMatch.upsert({
                where: {
                  requirementId_nodeId_matcherType: {
                    requirementId: requirement.id,
                    nodeId: node.nodeId,
                    matcherType,
                  },
                },
                create: {
                  requirementId: requirement.id,
                  nodeId: node.nodeId,
                  matchScore,
                  matchTypes,
                  confidence,
                  matcherType,
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
        { timeout: 300000, maxWait: 60000 } // Expanded transaction timeout to 5 minutes to allow thousands of upserts to settle safely.
      );

      return {
        message: `Found ${matches.length} matching code sections`,
        requirementId,
        matcherType,
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

  async matchAllRequirements(
    projectId: string,
    matcherType: MatcherType = 'hybrid',
    options?: ExperimentMatchOptions
  ) {
    this.logger.log(`Matching all requirements for project ${projectId} (matcher: ${matcherType})`);

    const requirements = await this.prisma.requirement.findMany({
      where: { projectId },
      select: { id: true, title: true },
    });

    if (requirements.length === 0) {
      return {
        message: 'No requirements found for this project',
        projectId,
        total: 0,
        matched: 0,
        failed: 0,
        results: [],
      };
    }

    const results = [];
    let matched = 0;
    let failed = 0;

    // Process requirements in parallel batches to optimize performance
    const BATCH_SIZE = 5;
    for (let i = 0; i < requirements.length; i += BATCH_SIZE) {
      const batch = requirements.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (requirement) => {
        try {
          this.logger.log(`Matching requirement ${requirement.id}: ${requirement.title}`);
          const result = await this.matchRequirements(
            requirement.id,
            projectId,
            matcherType,
            options
          );
          matched++;
          return {
            requirementId: requirement.id,
            requirementTitle: requirement.title,
            success: true,
            matchCount: result.matches?.length || 0,
          };
        } catch (error) {
          this.logger.error(`Failed to match requirement ${requirement.id}:`, error);
          failed++;
          return {
            requirementId: requirement.id,
            requirementTitle: requirement.title,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      message: `Matched ${matched} out of ${requirements.length} requirements`,
      projectId,
      matcherType,
      total: requirements.length,
      matched,
      failed,
      results,
    };
  }

  /** Run match-all for all four baselines so each has stored predictions (fixes 0.0 for other baselines). */
  async matchAllBaselines(projectId: string) {
    const matcherTypes: MatcherType[] = ['tfidf', 'embedding', 'structural-only', 'hybrid'];
    const reqIds = await this.prisma.requirement.findMany({
      where: { projectId },
      select: { id: true },
    });
    const requirementIds = reqIds.map((r) => r.id);

    const results: Array<{
      matcherType: MatcherType;
      total: number;
      matched: number;
      failed: number;
      linksStored: number;
      message: string;
    }> = [];
    for (const matcherType of matcherTypes) {
      this.logger.log(`[matchAllBaselines] Running ${matcherType} for project ${projectId}`);
      const out = await this.matchAllRequirements(projectId, matcherType);
      const linksStored =
        requirementIds.length === 0
          ? 0
          : await this.prisma.requirementMatch.count({
              where: {
                requirementId: { in: requirementIds },
                matcherType,
              },
            });
      results.push({
        matcherType,
        total: out.total,
        matched: out.matched,
        failed: out.failed,
        linksStored,
        message: out.message,
      });
    }
    return { projectId, results };
  }

  /**
   * Enqueue match-all jobs for all projects in the system.
   * Useful for a "research master button" to prepare the entire dataset.
   */
  async enqueueAllProjectsMatchAll() {
    const projects = await this.prisma.project.findMany({
      select: { id: true, name: true },
    });

    for (const project of projects) {
      this.logger.log(`Enqueuing all baselines match job for project ${project.name} (${project.id})`);
      await this.queue.enqueue('match-requirements', {
        projectId: project.id,
        type: 'match-all-baselines',
      });
    }

    return {
      message: `Enqueued matching jobs for ${projects.length} projects`,
      count: projects.length,
      projects: projects.map((p) => p.name),
    };
  }

  async getQueueStatus() {
    return this.queue.getQueueStatus('match-requirements');
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

    // Get requirements linked to project (default UI shows hybrid matcher results only)
    const requirements = await this.prisma.requirement.findMany({
      where: {
        projectId: projectId,
      },
      include: {
        requirementMatches: {
          where: { matcherType: 'hybrid' },
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
        text: r.text,
        type: r.type,
        status: r.status,
        matchCount: r.requirementMatches.length,
        completionPercentage: this.calculateRequirementCompletion(r),
        requirementMatches: r.requirementMatches.map((m) => ({
          id: m.id,
          nodeId: m.nodeId,
          matchScore: m.matchScore,
          matchTypes: m.matchTypes,
          confidence: m.confidence,
          node: m.node
            ? {
                filePath: m.node.filePath,
                nodePath: m.node.nodePath,
                nodeType: m.node.nodeType,
              }
            : null,
        })),
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

  async deleteRequirement(requirementId: string) {
    this.logger.log(`Deleting requirement: ${requirementId}`);

    const existing = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!existing) {
      return {
        message: 'Requirement already deleted or not found',
        requirementId,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.requirementMatch.deleteMany({
        where: { requirementId },
      });

      await tx.requirement.delete({
        where: { id: requirementId },
      });
    });

    return {
      message: 'Requirement deleted successfully',
      requirementId,
    };
  }

  async deleteProjectRequirements(projectId: string) {
    this.logger.log(`Deleting all requirements for project: ${projectId}`);

    const requirements = await this.prisma.requirement.findMany({
      where: { projectId },
      select: { id: true },
    });

    const requirementIds = requirements.map((r) => r.id);

    await this.prisma.$transaction(async (tx) => {
      if (requirementIds.length > 0) {
        await tx.requirementMatch.deleteMany({
          where: { requirementId: { in: requirementIds } },
        });
      }

      await tx.requirement.deleteMany({
        where: { projectId },
      });
    });

    return {
      message: `Deleted ${requirements.length} requirement(s) for project`,
      projectId,
      deletedCount: requirements.length,
    };
  }
}
