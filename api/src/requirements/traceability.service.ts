import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';

/**
 * Traceability Service
 * Provides comprehensive traceability analysis for requirements
 */
@Injectable()
export class TraceabilityService {
  private readonly logger = new Logger(TraceabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate full traceability matrix for a project
   */
  async generateTraceabilityMatrix(projectId: string) {
    this.logger.log(`Generating traceability matrix for project ${projectId}`);

    try {
      const requirements = await this.prisma.requirement.findMany({
        where: { projectId },
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
        },
        orderBy: { createdAt: 'desc' },
      });

      const matrix = requirements.map((req) => {
        const matches = req.requirementMatches || [];

        return {
          requirement: {
            id: req.id,
            title: req.title,
            type: req.type,
            status: req.status,
          },
          codeMatches: matches.map((match) => ({
            nodeId: match.nodeId,
            filePath: match.node.nodePath,
            matchScore: match.matchScore,
            matchTypes: match.matchTypes,
            confidence: match.confidence,
            verified: match.matchTypes.includes('verified'),
            repo: match.node.repo
              ? {
                  name: match.node.repo.name,
                  url: match.node.repo.url,
                }
              : null,
          })),
          matchCount: matches.length,
          completionPercentage: this.calculateRequirementCompletion(req, matches),
        };
      });

      return {
        projectId,
        totalRequirements: requirements.length,
        matrix,
        summary: this.generateSummary(matrix),
      };
    } catch (error) {
      this.logger.error('Failed to generate traceability matrix:', error);
      throw new Error(
        'Failed to generate traceability matrix: ' +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Get full traceability chain for a specific requirement
   */
  async getRequirementTraceability(requirementId: string) {
    this.logger.log(`Getting traceability for requirement ${requirementId}`);

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        requirementMatches: {
          include: {
            node: {
              include: {
                repo: true,
                symbol: true,
                fromRefs: {
                  include: {
                    fromNode: true,
                    toNode: true,
                  },
                },
                toRefs: {
                  include: {
                    fromNode: true,
                    toNode: true,
                  },
                },
              },
            },
          },
        },
        project: true,
      },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    // Build traceability chain
    const matches = requirement.requirementMatches || [];
    const traceabilityChain = matches.map((match) => {
      const node = match.node;

      return {
        match: {
          id: match.id,
          matchScore: match.matchScore,
          matchTypes: match.matchTypes,
          confidence: match.confidence,
          verified: match.matchTypes.includes('verified'),
        },
        codeNode: {
          id: node.id,
          nodePath: node.nodePath,
          nodeType: node.nodeType,
          filePath: node.filePath,
          startLine: node.startLine,
          endLine: node.endLine,
          summary: node.summary,
        },
        repository: node.repo
          ? {
              id: node.repo.id,
              name: node.repo.name,
              url: node.repo.url,
            }
          : null,
        dependencies: {
          calls: node.toRefs.map((ref) => ({
            toNode: ref.toNode.nodePath,
            kind: ref.kind,
          })),
          calledBy: node.fromRefs.map((ref) => ({
            fromNode: ref.fromNode.nodePath,
            kind: ref.kind,
          })),
        },
      };
    });

    return {
      requirement: {
        id: requirement.id,
        title: requirement.title,
        text: requirement.text,
        type: requirement.type,
        status: requirement.status,
      },
      project: requirement.project
        ? {
            id: requirement.project.id,
            name: requirement.project.name,
          }
        : null,
      traceabilityChain,
      summary: {
        totalMatches: matches.length,
        verifiedMatches: matches.filter((m) => m.matchTypes.includes('verified')).length,
        highConfidenceMatches: matches.filter((m) => m.confidence === 'high').length,
        completionPercentage: this.calculateRequirementCompletion(requirement, matches),
      },
    };
  }

  /**
   * Impact analysis: What breaks if code changes?
   */
  async analyzeImpact(nodeId: string, projectId?: string) {
    this.logger.log(`Analyzing impact for node ${nodeId}`);

    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      include: {
        requirementMatches: {
          include: {
            requirement: {
              include: {
                project: true,
              },
            },
          },
        },
        toRefs: {
          include: {
            toNode: true,
          },
        },
        fromRefs: {
          include: {
            fromNode: true,
          },
        },
      },
    });

    if (!node) {
      throw new Error('Node not found');
    }

    // Find all requirements that depend on this node
    const affectedRequirements = node.requirementMatches.map((match) => ({
      requirement: {
        id: match.requirement.id,
        title: match.requirement.title,
        type: match.requirement.type,
        status: match.requirement.status,
      },
      match: {
        matchScore: match.matchScore,
        confidence: match.confidence,
        verified: match.matchTypes.includes('verified'),
      },
      project: match.requirement.project
        ? {
            id: match.requirement.project.id,
            name: match.requirement.project.name,
          }
        : null,
    }));

    // Find dependent nodes (nodes that call this one)
    const dependentNodes = node.fromRefs.map((ref) => ({
      nodeId: ref.fromNode.id,
      nodePath: ref.fromNode.nodePath,
      kind: ref.kind,
    }));

    return {
      node: {
        id: node.id,
        nodePath: node.nodePath,
        nodeType: node.nodeType,
        filePath: node.filePath,
      },
      impact: {
        affectedRequirements: affectedRequirements.length,
        dependentNodes: dependentNodes.length,
        critical: affectedRequirements.some(
          (r) => r.match.verified && r.match.confidence === 'high'
        ),
      },
      affectedRequirements,
      dependentNodes,
    };
  }

  /**
   * Export traceability matrix in various formats
   */
  async exportTraceabilityMatrix(projectId: string, format: 'json' | 'csv' | 'markdown' = 'json') {
    const matrix = await this.generateTraceabilityMatrix(projectId);

    switch (format) {
      case 'csv':
        return this.exportAsCSV(matrix);
      case 'markdown':
        return this.exportAsMarkdown(matrix);
      default:
        return matrix;
    }
  }

  private exportAsCSV(matrix: any): string {
    const headers = [
      'Requirement ID',
      'Requirement Title',
      'Type',
      'Status',
      'Match Count',
      'Completion %',
      'Code Nodes',
    ];
    const rows = matrix.matrix.map((item: any) => [
      item.requirement.id,
      item.requirement.title,
      item.requirement.type,
      item.requirement.status,
      item.matchCount,
      item.completionPercentage,
      item.codeMatches.map((m: any) => m.filePath).join('; '),
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  private exportAsMarkdown(matrix: any): string {
    let markdown = `# Traceability Matrix\n\n`;
    markdown += `**Project:** ${matrix.projectId}\n`;
    markdown += `**Total Requirements:** ${matrix.totalRequirements}\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `- Overall Completion: ${matrix.summary.overallCompletion}%\n`;
    markdown += `- Fully Implemented: ${matrix.summary.fullyImplemented}\n`;
    markdown += `- Partially Implemented: ${matrix.summary.partiallyImplemented}\n`;
    markdown += `- Not Implemented: ${matrix.summary.notImplemented}\n\n`;
    markdown += `## Requirements\n\n`;

    matrix.matrix.forEach((item: any) => {
      markdown += `### ${item.requirement.title}\n\n`;
      markdown += `- **ID:** ${item.requirement.id}\n`;
      markdown += `- **Type:** ${item.requirement.type}\n`;
      markdown += `- **Status:** ${item.requirement.status}\n`;
      markdown += `- **Completion:** ${item.completionPercentage}%\n`;
      markdown += `- **Matches:** ${item.matchCount}\n\n`;

      if (item.codeMatches.length > 0) {
        markdown += `**Code Matches:**\n\n`;
        item.codeMatches.forEach((match: any) => {
          markdown += `- ${match.filePath} (Score: ${match.matchScore}, Confidence: ${match.confidence})\n`;
        });
        markdown += `\n`;
      }
    });

    return markdown;
  }

  private calculateRequirementCompletion(requirement: any, matches?: any[]): number {
    const requirementMatches = matches || requirement.requirementMatches || [];

    if (requirementMatches.length === 0) return 0;

    const weightedSum = requirementMatches.reduce((sum: number, m: any) => {
      const weight = m.confidence === 'high' ? 1.0 : m.confidence === 'medium' ? 0.7 : 0.4;
      return sum + m.matchScore * weight;
    }, 0);

    const totalWeight = requirementMatches.reduce((sum: number, m: any) => {
      return sum + (m.confidence === 'high' ? 1.0 : m.confidence === 'medium' ? 0.7 : 0.4);
    }, 0);

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
  }

  private generateSummary(matrix: any[]): any {
    const total = matrix.length;
    const fullyImplemented = matrix.filter((m) => m.completionPercentage >= 80).length;
    const partiallyImplemented = matrix.filter(
      (m) => m.completionPercentage > 0 && m.completionPercentage < 80
    ).length;
    const notImplemented = matrix.filter((m) => m.completionPercentage === 0).length;

    const overallCompletion =
      total > 0
        ? Math.round(matrix.reduce((sum, m) => sum + m.completionPercentage, 0) / total)
        : 0;

    return {
      overallCompletion,
      fullyImplemented,
      partiallyImplemented,
      notImplemented,
      total,
    };
  }
}
