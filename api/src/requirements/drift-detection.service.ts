import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { TensorService } from '../common/tensor/tensor.service';

/**
 * Drift Detection Service
 * Detects when code changes cause requirements to no longer match
 */
@Injectable()
export class DriftDetectionService {
  private readonly logger = new Logger(DriftDetectionService.name);
  private readonly DRIFT_THRESHOLD = 0.3; // If match score drops below this, consider it drift

  constructor(
    private readonly prisma: PrismaService,
    private readonly tensor: TensorService
  ) {}

  /**
   * Detect requirements drift for a project
   */
  async detectDrift(projectId: string) {
    this.logger.log(`Detecting requirements drift for project ${projectId}`);

    try {
      const requirements = await this.prisma.requirement.findMany({
        where: { projectId },
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
      });

      const driftResults = await Promise.all(
        requirements.map((req) => this.checkRequirementDrift(req))
      );

      const driftedRequirements = driftResults.filter((r) => r.hasDrift);
      const stableRequirements = driftResults.filter((r) => !r.hasDrift);

      return {
        projectId,
        totalRequirements: requirements.length,
        driftedCount: driftedRequirements.length,
        stableCount: stableRequirements.length,
        driftPercentage:
          requirements.length > 0
            ? Math.round((driftedRequirements.length / requirements.length) * 100)
            : 0,
        driftedRequirements,
        stableRequirements,
      };
    } catch (error) {
      this.logger.error('Failed to detect drift:', error);
      throw new Error(
        'Failed to detect drift: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Check if a specific requirement has drifted
   */
  async checkRequirementDrift(requirement: any) {
    const matches = requirement.requirementMatches || [];

    if (matches.length === 0) {
      return {
        requirementId: requirement.id,
        requirementTitle: requirement.title,
        hasDrift: false,
        reason: 'No matches to check',
        matches: [],
      };
    }

    // Re-validate each match by checking if the code still matches
    const validatedMatches = await Promise.all(
      matches.map(async (match) => {
        try {
          // Get current node state
          const node = await this.prisma.node.findUnique({
            where: { id: match.nodeId },
            include: {
              repo: true,
            },
          });

          if (!node) {
            return {
              matchId: match.id,
              nodeId: match.nodeId,
              hasDrift: true,
              reason: 'Node no longer exists',
              originalScore: match.matchScore,
              currentScore: 0,
            };
          }

          // Recalculate similarity
          const currentScore = await this.recalculateSimilarity(requirement.text, node);

          const hasDrift =
            currentScore < this.DRIFT_THRESHOLD || match.matchScore - currentScore > 0.2; // Significant drop

          return {
            matchId: match.id,
            nodeId: match.nodeId,
            filePath: node.filePath,
            nodePath: node.nodePath,
            hasDrift,
            reason: hasDrift ? 'Match score dropped significantly' : 'Match still valid',
            originalScore: match.matchScore,
            currentScore,
            scoreChange: currentScore - match.matchScore,
          };
        } catch (error) {
          this.logger.warn(`Failed to validate match ${match.id}:`, error);
          return {
            matchId: match.id,
            nodeId: match.nodeId,
            hasDrift: true,
            reason: 'Validation failed',
            originalScore: match.matchScore,
            currentScore: 0,
          };
        }
      })
    );

    const driftedMatches = validatedMatches.filter((m) => m.hasDrift);
    const hasDrift = driftedMatches.length > 0;

    // Save drift detection to database if drift is detected
    if (hasDrift) {
      const severity =
        driftedMatches.length === matches.length
          ? 'critical'
          : driftedMatches.length > matches.length / 2
            ? 'high'
            : 'medium';

      // Calculate average score change
      const avgOldScore =
        driftedMatches.reduce((sum, m) => sum + m.originalScore, 0) / driftedMatches.length;
      const avgNewScore =
        driftedMatches.reduce((sum, m) => sum + m.currentScore, 0) / driftedMatches.length;

      await this.prisma.driftDetection.create({
        data: {
          requirementId: requirement.id,
          severity,
          oldScore: avgOldScore,
          newScore: avgNewScore,
        },
      });
    }

    return {
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      hasDrift,
      driftSeverity: hasDrift
        ? driftedMatches.length === matches.length
          ? 'critical'
          : driftedMatches.length > matches.length / 2
            ? 'high'
            : 'medium'
        : 'none',
      matches: validatedMatches,
      driftedMatches: driftedMatches.length,
      totalMatches: matches.length,
    };
  }

  /**
   * Recalculate similarity between requirement and current node state
   */
  private async recalculateSimilarity(requirementText: string, node: any): Promise<number> {
    try {
      // Generate embeddings
      const [reqEmbedding, nodeEmbedding] = await Promise.all([
        this.tensor.embed([requirementText]),
        this.tensor.embed([node.summary || node.text || '']),
      ]);

      if (
        reqEmbedding.vectors &&
        nodeEmbedding.vectors &&
        reqEmbedding.vectors.length > 0 &&
        nodeEmbedding.vectors.length > 0
      ) {
        // Calculate cosine similarity
        return this.cosineSimilarity(reqEmbedding.vectors[0], nodeEmbedding.vectors[0]);
      }
    } catch (error) {
      this.logger.warn(
        'Failed to recalculate similarity with embeddings, using text similarity:',
        error
      );
    }

    // Fallback to text similarity
    return this.textSimilarity(requirementText, node.summary || node.text || '');
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Text-based similarity (fallback)
   */
  private textSimilarity(text1: string, text2: string): number {
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

  /**
   * Update match scores after detecting drift
   */
  async updateDriftedMatches(requirementId: string, driftedMatches: any[]) {
    this.logger.log(
      `Updating ${driftedMatches.length} drifted matches for requirement ${requirementId}`
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        await Promise.all(
          driftedMatches.map((match) =>
            tx.requirementMatch.update({
              where: { id: match.matchId },
              data: {
                matchScore: match.currentScore,
                confidence: match.currentScore > 0.6 ? 'medium' : 'low',
                matchTypes: match.hasDrift
                  ? match.matchTypes.filter((t: string) => t !== 'verified')
                  : match.matchTypes,
              },
            })
          )
        );
      });

      return {
        message: `Updated ${driftedMatches.length} matches`,
        requirementId,
      };
    } catch (error) {
      this.logger.error('Failed to update drifted matches:', error);
      throw new Error(
        'Failed to update drifted matches: ' +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }
}
