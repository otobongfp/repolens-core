import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';

/**
 * Gap Analysis Service
 * Identifies unimplemented requirements and prioritizes them
 */
@Injectable()
export class GapAnalysisService {
  private readonly logger = new Logger(GapAnalysisService.name);
  private readonly COMPLETION_THRESHOLD = 50; // Below this is considered a gap

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all gaps (unimplemented or partially implemented requirements) for a project
   */
  async getGaps(projectId: string) {
    this.logger.log(`Analyzing gaps for project ${projectId}`);

    try {
      const requirements = await this.prisma.requirement.findMany({
        where: {
          projectId,
          status: 'accepted', // Only analyze accepted requirements
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
      });

      const gaps = requirements
        .map((req) => {
          const completion = this.calculateCompletion(req);
          return {
            requirement: {
              id: req.id,
              title: req.title,
              text: req.text,
              type: req.type,
            },
            completion,
            matchCount: req.requirementMatches.length,
            isGap: completion < this.COMPLETION_THRESHOLD,
            priority: this.calculatePriority(req, completion),
            estimatedEffort: this.estimateEffort(req),
          };
        })
        .filter((g) => g.isGap)
        .sort((a, b) => {
          // Sort by priority (high first), then by completion (lowest first)
          if (a.priority !== b.priority) {
            return a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0;
          }
          return a.completion - b.completion;
        });

      // Save gap analyses to database
      const codebaseStructure = await this.analyzeCodebaseStructure(projectId);
      await this.prisma.$transaction(
        gaps.map((gap) =>
          this.prisma.gapAnalysis.create({
            data: {
              projectId,
              requirementId: gap.requirement.id,
              gapType: gap.matchCount === 0 ? 'missing_implementation' : 'incomplete',
              priority: gap.priority,
              effortEstimate: gap.estimatedEffort,
              suggestions: this.generateSuggestions(gap.requirement, codebaseStructure, []).join(
                '; '
              ),
            },
          })
        )
      );

      return {
        projectId,
        totalGaps: gaps.length,
        totalRequirements: requirements.length,
        gapPercentage:
          requirements.length > 0 ? Math.round((gaps.length / requirements.length) * 100) : 0,
        gaps,
        summary: this.generateGapSummary(gaps),
      };
    } catch (error) {
      this.logger.error('Failed to analyze gaps:', error);
      throw new Error(
        'Failed to analyze gaps: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Get high-priority gaps that need immediate attention
   */
  async getHighPriorityGaps(projectId: string) {
    const gaps = await this.getGaps(projectId);

    return {
      ...gaps,
      gaps: gaps.gaps.filter((g) => g.priority === 'high'),
    };
  }

  /**
   * Generate implementation suggestions for gaps
   */
  async generateImplementationSuggestions(requirementId: string) {
    this.logger.log(`Generating implementation suggestions for requirement ${requirementId}`);

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        requirementMatches: {
          include: {
            node: {
              include: {
                repo: true,
                symbol: true,
              },
            },
          },
        },
        project: {
          include: {
            repositories: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    const completion = this.calculateCompletion(requirement);
    const matches = requirement.requirementMatches || [];

    // Analyze existing codebase structure
    const codebaseStructure = await this.analyzeCodebaseStructure(requirement.projectId);

    const suggestions = {
      requirement: {
        id: requirement.id,
        title: requirement.title,
        text: requirement.text,
      },
      currentState: {
        completion,
        matchCount: matches.length,
        existingMatches: matches.map((m) => ({
          filePath: m.node.filePath,
          nodePath: m.node.nodePath,
          matchScore: m.matchScore,
        })),
      },
      suggestions: this.generateSuggestions(requirement, codebaseStructure, matches),
      estimatedEffort: this.estimateEffort(requirement),
      recommendedApproach: this.recommendApproach(requirement, codebaseStructure),
    };

    return suggestions;
  }

  private calculateCompletion(requirement: any): number {
    const matches = requirement.requirementMatches || [];

    if (matches.length === 0) return 0;

    const weightedSum = matches.reduce((sum: number, m: any) => {
      const weight = m.confidence === 'high' ? 1.0 : m.confidence === 'medium' ? 0.7 : 0.4;
      return sum + m.matchScore * weight;
    }, 0);

    const totalWeight = matches.reduce((sum: number, m: any) => {
      return sum + (m.confidence === 'high' ? 1.0 : m.confidence === 'medium' ? 0.7 : 0.4);
    }, 0);

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
  }

  private calculatePriority(requirement: any, completion: number): 'high' | 'medium' | 'low' {
    // High priority: critical features with low completion
    if (completion < 20 && requirement.type === 'feature') {
      return 'high';
    }

    // Medium priority: features with partial implementation
    if (completion < this.COMPLETION_THRESHOLD && requirement.type === 'feature') {
      return 'medium';
    }

    // Low priority: suggestions or partially implemented
    return 'low';
  }

  private estimateEffort(requirement: any): 'small' | 'medium' | 'large' {
    const textLength = requirement.text.length;
    const complexity =
      requirement.text.toLowerCase().includes('complex') ||
      requirement.text.toLowerCase().includes('integration') ||
      requirement.text.toLowerCase().includes('system');

    if (complexity || textLength > 500) {
      return 'large';
    } else if (textLength > 200) {
      return 'medium';
    } else {
      return 'small';
    }
  }

  private async analyzeCodebaseStructure(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: true,
      },
    });

    if (!project) {
      return {
        languages: [],
        frameworks: [],
        patterns: [],
      };
    }

    // Get code structure from nodes
    const repos = await this.prisma.repo.findMany({
      where: {
        url: {
          in: project.repositories.map((r) => r.url).filter((url) => url !== null) as string[],
        },
      },
    });

    const nodes = await this.prisma.node.findMany({
      where: {
        repoId: { in: repos.map((r) => r.id) },
      },
      take: 1000,
    });

    const languages = new Set(
      nodes.map((n) => {
        const ext = n.filePath.split('.').pop()?.toLowerCase();
        return ext || 'unknown';
      })
    );

    return {
      languages: Array.from(languages),
      nodeCount: nodes.length,
      fileTypes: this.analyzeFileTypes(nodes),
    };
  }

  private analyzeFileTypes(nodes: any[]): Record<string, number> {
    const fileTypes: Record<string, number> = {};

    nodes.forEach((node) => {
      const ext = node.filePath.split('.').pop()?.toLowerCase() || 'unknown';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    });

    return fileTypes;
  }

  private generateSuggestions(requirement: any, codebaseStructure: any, matches: any[]): string[] {
    const suggestions: string[] = [];

    if (matches.length === 0) {
      suggestions.push('No existing implementation found. Consider creating new components.');
      suggestions.push(
        `Based on codebase structure (${codebaseStructure.languages.join(', ')}), implement using similar patterns.`
      );
    } else if (matches.length < 3) {
      suggestions.push('Partial implementation exists. Consider extending existing components.');
      suggestions.push('Review existing matches to understand current implementation approach.');
    }

    if (codebaseStructure.languages.length > 0) {
      suggestions.push(
        `Use ${codebaseStructure.languages[0]} following existing codebase patterns.`
      );
    }

    return suggestions;
  }

  private recommendApproach(requirement: any, codebaseStructure: any): string {
    const matches = requirement.requirementMatches || [];

    if (matches.length === 0) {
      return 'Create new implementation from scratch';
    } else if (matches.length === 1) {
      return 'Extend existing implementation';
    } else {
      return 'Refactor and consolidate existing implementations';
    }
  }

  private generateGapSummary(gaps: any[]): any {
    const byPriority = {
      high: gaps.filter((g) => g.priority === 'high').length,
      medium: gaps.filter((g) => g.priority === 'medium').length,
      low: gaps.filter((g) => g.priority === 'low').length,
    };

    const byEffort = {
      small: gaps.filter((g) => g.estimatedEffort === 'small').length,
      medium: gaps.filter((g) => g.estimatedEffort === 'medium').length,
      large: gaps.filter((g) => g.estimatedEffort === 'large').length,
    };

    return {
      byPriority,
      byEffort,
      averageCompletion:
        gaps.length > 0
          ? Math.round(gaps.reduce((sum, g) => sum + g.completion, 0) / gaps.length)
          : 0,
    };
  }
}
