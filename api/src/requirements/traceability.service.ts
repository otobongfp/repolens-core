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
            where: { matcherType: 'hybrid' },
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
        const matches = (req.requirementMatches || []).filter((m) => m.node != null);

        return {
          requirement: {
            id: req.id,
            title: req.title,
            type: req.type,
            status: req.status,
          },
          codeMatches: matches.map((match) => ({
            nodeId: match.nodeId,
            filePath: match.node!.filePath || match.node!.nodePath || 'Unknown',
            nodePath: match.node!.nodePath || '',
            matchScore: match.matchScore,
            matchTypes: match.matchTypes,
            confidence: match.confidence,
            verified: Array.isArray(match.matchTypes) && match.matchTypes.includes('verified'),
            repo: match.node!.repo
              ? {
                  name: match.node!.repo.name,
                  url: match.node!.repo.url,
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
          where: { matcherType: 'hybrid' },
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
    const traceabilityChain = matches
      .filter((match) => match.node != null)
      .map((match) => {
        const node = match.node!;
        const fromRefs = node.fromRefs ?? [];
        const toRefs = node.toRefs ?? [];
        // fromRefs = refs where this node is source → we call ref.toNode (callee)
        // toRefs = refs where this node is target → ref.fromNode calls us (caller)
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
            summary: node.summary ?? undefined,
          },
          repository: node.repo
            ? {
                id: node.repo.id,
                name: node.repo.name,
                url: node.repo.url,
              }
            : null,
          dependencies: {
            calls: fromRefs.map((ref) => ({
              toNode: ref.toNode?.nodePath ?? '',
              kind: ref.kind,
            })),
            calledBy: toRefs.map((ref) => ({
              fromNode: ref.fromNode?.nodePath ?? '',
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
          where: { matcherType: 'hybrid' },
          include: {
            requirement: {
              include: {
                project: true,
              },
            },
          },
        },
        symbol: {
          include: {
            fromRefs: {
              include: {
                fromSymbol: {
                  include: {
                    node: true,
                  },
                },
                toSymbol: {
                  include: {
                    node: true,
                  },
                },
                fromNode: true,
                toNode: true,
              },
            },
            toRefs: {
              include: {
                fromSymbol: {
                  include: {
                    node: true,
                  },
                },
                toSymbol: {
                  include: {
                    node: true,
                  },
                },
                fromNode: true,
                toNode: true,
              },
            },
          },
        },
        toRefs: {
          include: {
            toNode: {
              include: {
                symbol: true,
              },
            },
            fromNode: {
              include: {
                symbol: true,
              },
            },
          },
        },
        fromRefs: {
          include: {
            fromNode: {
              include: {
                symbol: true,
              },
            },
            toNode: {
              include: {
                symbol: true,
              },
            },
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

    const fromRefs = node.fromRefs ?? []; // refs where this node is source → we call ref.toNode
    const toRefs = node.toRefs ?? []; // refs where this node is target → ref.fromNode calls us
    const dependencies = fromRefs
      .filter((ref) => ref.toNode != null)
      .map((ref) => ({
        nodeId: ref.toNode!.id,
        nodePath: ref.toNode!.nodePath,
        filePath: ref.toNode!.filePath,
        kind: ref.kind,
        context: ref.context ?? undefined,
        symbol: ref.toNode!.symbol
          ? {
              name: ref.toNode!.symbol.name,
              kind: ref.toNode!.symbol.kind,
              signature: ref.toNode!.symbol.signature,
            }
          : null,
      }));

    const dependents = toRefs
      .filter((ref) => ref.fromNode != null)
      .map((ref) => ({
        nodeId: ref.fromNode!.id,
        nodePath: ref.fromNode!.nodePath,
        filePath: ref.fromNode!.filePath,
        kind: ref.kind,
        context: ref.context ?? undefined,
        symbol: ref.fromNode!.symbol
          ? {
              name: ref.fromNode!.symbol.name,
              kind: ref.fromNode!.symbol.kind,
              signature: ref.fromNode!.symbol.signature,
            }
          : null,
      }));

    // Group by kind for better analysis
    const dependenciesByKind = dependencies.reduce((acc, dep) => {
      if (!acc[dep.kind]) acc[dep.kind] = [];
      acc[dep.kind].push(dep);
      return acc;
    }, {} as Record<string, typeof dependencies>);

    const dependentsByKind = dependents.reduce((acc, dep) => {
      if (!acc[dep.kind]) acc[dep.kind] = [];
      acc[dep.kind].push(dep);
      return acc;
    }, {} as Record<string, typeof dependents>);

    return {
      node: {
        id: node.id,
        nodePath: node.nodePath,
        nodeType: node.nodeType,
        filePath: node.filePath,
        symbol: node.symbol
          ? {
              name: node.symbol.name,
              kind: node.symbol.kind,
              signature: node.symbol.signature,
            }
          : null,
      },
      impact: {
        affectedRequirements: affectedRequirements.length,
        dependencies: dependencies.length,
        dependents: dependents.length,
        critical: affectedRequirements.some(
          (r) => r.match.verified && r.match.confidence === 'high'
        ),
      },
      affectedRequirements,
      dependencies,
      dependents,
      dependenciesByKind,
      dependentsByKind,
    };
  }

  /**
   * Get full dependency graph for a requirement using SymbolRef
   */
  async getDependencyGraph(requirementId: string) {
    this.logger.log(`Getting dependency graph for requirement ${requirementId}`);

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        requirementMatches: {
          where: { matcherType: 'hybrid' },
          include: {
            node: {
              include: {
                symbol: {
                  include: {
                    fromRefs: {
                      include: {
                        toSymbol: {
                          include: {
                            node: true,
                          },
                        },
                        toNode: true,
                      },
                    },
                    toRefs: {
                      include: {
                        fromSymbol: {
                          include: {
                            node: true,
                          },
                        },
                        fromNode: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    const matches = requirement.requirementMatches || [];
    const graph: Array<{
      node: any;
      calls: Array<{ target: string; kind: string; context?: string }>;
      calledBy: Array<{ source: string; kind: string; context?: string }>;
      imports: Array<string>;
    }> = [];

    for (const match of matches) {
      const node = match.node;
      if (!node?.symbol) continue;

      const symFromRefs = node.symbol.fromRefs ?? [];
      const symToRefs = node.symbol.toRefs ?? [];
      const calls = symFromRefs.map((ref) => ({
        target: ref.toSymbol?.node?.nodePath ?? ref.toNode?.nodePath ?? '',
        kind: ref.kind,
        context: ref.context ?? undefined,
      }));

      const calledBy = symToRefs.map((ref) => ({
        source: ref.fromSymbol?.node?.nodePath ?? ref.fromNode?.nodePath ?? '',
        kind: ref.kind,
        context: ref.context ?? undefined,
      }));

      const imports = calls.filter((c) => c.kind === 'imports').map((c) => c.target);

      graph.push({
        node: {
          id: node.id,
          nodePath: node.nodePath,
          filePath: node.filePath,
          symbol: {
            name: node.symbol.name,
            kind: node.symbol.kind,
            signature: node.symbol.signature,
          },
        },
        calls: calls.filter((c) => c.kind !== 'imports'),
        calledBy,
        imports,
      });
    }

    return {
      requirement: {
        id: requirement.id,
        title: requirement.title,
      },
      graph,
      summary: {
        totalNodes: graph.length,
        totalCalls: graph.reduce((sum, g) => sum + g.calls.length, 0),
        totalImports: graph.reduce((sum, g) => sum + g.imports.length, 0),
        totalDependencies: graph.reduce((sum, g) => sum + g.calledBy.length, 0),
      },
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
    const items = matrix.matrix ?? [];
    const rows = items.map((item: any) => [
      item.requirement?.id ?? '',
      item.requirement?.title ?? '',
      item.requirement?.type ?? '',
      item.requirement?.status ?? '',
      item.matchCount ?? 0,
      item.completionPercentage ?? 0,
      (item.codeMatches ?? []).map((m: any) => m.filePath ?? '').join('; '),
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

    const items = matrix.matrix ?? [];
    items.forEach((item: any) => {
      markdown += `### ${item.requirement?.title ?? 'Requirement'}\n\n`;
      markdown += `- **ID:** ${item.requirement?.id ?? ''}\n`;
      markdown += `- **Type:** ${item.requirement?.type ?? ''}\n`;
      markdown += `- **Status:** ${item.requirement?.status ?? ''}\n`;
      markdown += `- **Completion:** ${item.completionPercentage ?? 0}%\n`;
      markdown += `- **Matches:** ${item.matchCount ?? 0}\n\n`;

      const codeMatches = item.codeMatches ?? [];
      if (codeMatches.length > 0) {
        markdown += `**Code Matches:**\n\n`;
        codeMatches.forEach((match: any) => {
          markdown += `- ${match.filePath ?? ''} (Score: ${match.matchScore ?? 0}, Confidence: ${match.confidence ?? ''})\n`;
        });
        markdown += `\n`;
      }
    });

    return markdown;
  }

  private calculateRequirementCompletion(requirement: any, matches?: any[]): number {
    const requirementMatches = matches ?? requirement?.requirementMatches ?? [];

    if (requirementMatches.length === 0) return 0;

    const weightedSum = requirementMatches.reduce((sum: number, m: any) => {
      const weight = m?.confidence === 'high' ? 1.0 : m?.confidence === 'medium' ? 0.7 : 0.4;
      return sum + (Number(m?.matchScore) || 0) * weight;
    }, 0);

    const totalWeight = requirementMatches.reduce((sum: number, m: any) => {
      return sum + (m?.confidence === 'high' ? 1.0 : m?.confidence === 'medium' ? 0.7 : 0.4);
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
