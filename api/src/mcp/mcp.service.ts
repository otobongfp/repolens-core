import { Injectable, Logger } from '@nestjs/common';
import { RequirementsService } from '../requirements/requirements.service';
import { TraceabilityService } from '../requirements/traceability.service';
import { DriftDetectionService } from '../requirements/drift-detection.service';
import { GapAnalysisService } from '../requirements/gap-analysis.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { ProjectsService } from '../projects/projects.service';

/**
 * MCP Service
 * Implements Model Context Protocol server for goose integration
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly requirementsService: RequirementsService,
    private readonly traceabilityService: TraceabilityService,
    private readonly driftDetectionService: DriftDetectionService,
    private readonly gapAnalysisService: GapAnalysisService,
    private readonly repositoriesService: RepositoriesService,
    private readonly projectsService: ProjectsService
  ) {}

  /**
   * List available MCP tools
   */
  listTools() {
    return [
      {
        name: 'repolens_analyze_codebase',
        description:
          'Analyze a codebase repository and generate AST embeddings. Returns code structure, nodes, and embeddings.',
        inputSchema: {
          type: 'object',
          properties: {
            repo_url: {
              type: 'string',
              description: 'Repository URL to analyze',
            },
            project_id: {
              type: 'string',
              description: 'Optional project ID to associate with',
            },
          },
          required: ['repo_url'],
        },
      },
      {
        name: 'repolens_extract_requirements',
        description:
          'Extract requirements from a document (PRD, ticket, etc.). Returns structured requirements with priorities.',
        inputSchema: {
          type: 'object',
          properties: {
            document_content: {
              type: 'string',
              description: 'Document content to extract requirements from',
            },
            project_id: {
              type: 'string',
              description: 'Project ID to associate requirements with',
            },
          },
          required: ['document_content'],
        },
      },
      {
        name: 'repolens_match_requirements',
        description:
          'Match requirements to codebase components using semantic search. Returns matching code nodes with scores.',
        inputSchema: {
          type: 'object',
          properties: {
            requirement_id: {
              type: 'string',
              description: 'Requirement ID to match',
            },
            project_id: {
              type: 'string',
              description: 'Optional project ID for context',
            },
          },
          required: ['requirement_id'],
        },
      },
      {
        name: 'repolens_get_traceability',
        description:
          'Get full traceability chain for a requirement. Shows requirement → code → dependencies.',
        inputSchema: {
          type: 'object',
          properties: {
            requirement_id: {
              type: 'string',
              description: 'Requirement ID to get traceability for',
            },
          },
          required: ['requirement_id'],
        },
      },
      {
        name: 'repolens_check_completeness',
        description:
          'Check requirement implementation completeness. Returns completion percentage and status.',
        inputSchema: {
          type: 'object',
          properties: {
            requirement_id: {
              type: 'string',
              description: 'Requirement ID to check',
            },
            project_id: {
              type: 'string',
              description: 'Optional project ID for context',
            },
          },
          required: ['requirement_id'],
        },
      },
      {
        name: 'repolens_get_gaps',
        description:
          'Get all unimplemented or partially implemented requirements (gaps) for a project.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: {
              type: 'string',
              description: 'Project ID to analyze',
            },
            priority_only: {
              type: 'boolean',
              description: 'Only return high-priority gaps',
              default: false,
            },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'repolens_validate_implementation',
        description:
          'Validate if code implementation matches a requirement. Returns validation result and confidence.',
        inputSchema: {
          type: 'object',
          properties: {
            code_path: {
              type: 'string',
              description: 'Path to code file or node ID',
            },
            requirement_id: {
              type: 'string',
              description: 'Requirement ID to validate against',
            },
          },
          required: ['code_path', 'requirement_id'],
        },
      },
      {
        name: 'repolens_suggest_implementation',
        description: 'Generate AI-powered implementation suggestions for a requirement gap.',
        inputSchema: {
          type: 'object',
          properties: {
            requirement_id: {
              type: 'string',
              description: 'Requirement ID to generate suggestions for',
            },
          },
          required: ['requirement_id'],
        },
      },
      {
        name: 'repolens_detect_drift',
        description:
          'Detect requirements drift - when code changes cause requirements to no longer match.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: {
              type: 'string',
              description: 'Project ID to check for drift',
            },
            requirement_id: {
              type: 'string',
              description: 'Optional: specific requirement ID to check',
            },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'repolens_generate_report',
        description: 'Generate comprehensive traceability and completeness report for a project.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: {
              type: 'string',
              description: 'Project ID to generate report for',
            },
            format: {
              type: 'string',
              enum: ['json', 'csv', 'markdown'],
              description: 'Report format',
              default: 'json',
            },
          },
          required: ['project_id'],
        },
      },
    ];
  }

  /**
   * Call an MCP tool
   */
  async callTool(
    user: any,
    request: {
      name: string;
      arguments: Record<string, any>;
    }
  ): Promise<any> {
    this.logger.log(`Calling MCP tool: ${request.name}`);

    try {
      switch (request.name) {
        case 'repolens_analyze_codebase':
          return await this.handleAnalyzeCodebase(
            request.arguments.repo_url,
            request.arguments.project_id
          );

        case 'repolens_extract_requirements':
          return await this.handleExtractRequirements(
            request.arguments.document_content,
            request.arguments.project_id
          );

        case 'repolens_match_requirements':
          return await this.handleMatchRequirements(
            request.arguments.requirement_id,
            request.arguments.project_id
          );

        case 'repolens_get_traceability':
          return await this.handleGetTraceability(request.arguments.requirement_id);

        case 'repolens_check_completeness':
          return await this.handleCheckCompleteness(
            request.arguments.requirement_id,
            request.arguments.project_id
          );

        case 'repolens_get_gaps':
          if (request.arguments.priority_only) {
            return await this.gapAnalysisService.getHighPriorityGaps(request.arguments.project_id);
          }
          return await this.gapAnalysisService.getGaps(request.arguments.project_id);

        case 'repolens_validate_implementation':
          return await this.handleValidateImplementation(
            request.arguments.code_path,
            request.arguments.requirement_id
          );

        case 'repolens_suggest_implementation':
          return await this.gapAnalysisService.generateImplementationSuggestions(
            request.arguments.requirement_id
          );

        case 'repolens_detect_drift':
          if (request.arguments.requirement_id) {
            // Check specific requirement
            const requirement = await this.requirementsService['prisma'].requirement.findUnique({
              where: { id: request.arguments.requirement_id },
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
            if (!requirement) {
              throw new Error('Requirement not found');
            }
            return await this.driftDetectionService.checkRequirementDrift(requirement);
          }
          return await this.driftDetectionService.detectDrift(request.arguments.project_id);

        case 'repolens_generate_report':
          return await this.traceabilityService.exportTraceabilityMatrix(
            request.arguments.project_id,
            request.arguments.format || 'json'
          );

        default:
          throw new Error(`Unknown tool: ${request.name}`);
      }
    } catch (error) {
      this.logger.error(`MCP tool ${request.name} failed:`, error);
      throw new Error(
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleAnalyzeCodebase(repoUrl: string, projectId?: string) {
    return {
      message: 'Codebase analysis initiated',
      repo_url: repoUrl,
      project_id: projectId,
      status: 'queued',
    };
  }

  private async handleExtractRequirements(documentContent: string, projectId?: string) {
    return await this.requirementsService.extractRequirements(documentContent, projectId);
  }

  private async handleMatchRequirements(requirementId: string, projectId?: string) {
    return await this.requirementsService.matchRequirements(requirementId, projectId);
  }

  private async handleGetTraceability(requirementId: string) {
    return await this.traceabilityService.getRequirementTraceability(requirementId);
  }

  private async handleCheckCompleteness(requirementId: string, projectId?: string) {
    const requirement = await this.requirementsService['prisma'].requirement.findUnique({
      where: { id: requirementId },
      include: {
        requirementMatches: true,
      },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    const matches = requirement.requirementMatches || [];
    const completion = this.calculateCompletion(requirement, matches);

    return {
      requirement_id: requirementId,
      requirement_title: requirement.title,
      completion_percentage: completion,
      match_count: matches.length,
      status: completion >= 80 ? 'complete' : completion > 0 ? 'partial' : 'not_started',
      matches: matches.map((m) => ({
        node_id: m.nodeId,
        match_score: m.matchScore,
        confidence: m.confidence,
      })),
    };
  }

  private async handleValidateImplementation(codePath: string, requirementId: string) {
    // Find node by path or ID
    const node = await this.requirementsService['prisma'].node.findFirst({
      where: {
        OR: [
          { id: codePath },
          { filePath: { contains: codePath } },
          { nodePath: { contains: codePath } },
        ],
      },
      include: {
        requirementMatches: {
          where: {
            requirementId,
          },
        },
      },
    });

    if (!node) {
      return {
        valid: false,
        reason: 'Code node not found',
        code_path: codePath,
        requirement_id: requirementId,
      };
    }

    const match = node.requirementMatches[0];
    if (!match) {
      return {
        valid: false,
        reason: 'No match found between code and requirement',
        code_path: codePath,
        requirement_id: requirementId,
      };
    }

    return {
      valid: match.matchScore > 0.6 && match.confidence !== 'low',
      match_score: match.matchScore,
      confidence: match.confidence,
      match_types: match.matchTypes,
      code_path: codePath,
      requirement_id: requirementId,
      node_id: node.id,
    };
  }

  private calculateCompletion(requirement: any, matches: any[]): number {
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
}
