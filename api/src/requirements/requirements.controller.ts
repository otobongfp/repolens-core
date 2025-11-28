import { Controller, Post, Body, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RequirementsService } from './requirements.service';
import { TraceabilityService } from './traceability.service';
import { DriftDetectionService } from './drift-detection.service';
import { GapAnalysisService } from './gap-analysis.service';
import { ComplianceService } from './compliance.service';
import { RequirementsVersioningService } from './requirements-versioning.service';

@ApiTags('requirements')
@Controller('requirements')
export class RequirementsController {
  constructor(
    private readonly requirementsService: RequirementsService,
    private readonly traceabilityService: TraceabilityService,
    private readonly driftDetectionService: DriftDetectionService,
    private readonly gapAnalysisService: GapAnalysisService,
    private readonly complianceService: ComplianceService,
    private readonly versioningService: RequirementsVersioningService
  ) {}

  @Post('extract')
  @ApiOperation({ summary: 'Extract requirements from document (Core mode - no auth required)' })
  @ApiResponse({ status: 200, description: 'Requirements extracted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async extract(@Body() body: { documentContent: string; projectId?: string }) {
    if (!body.documentContent) {
      throw new Error('documentContent is required');
    }
    return this.requirementsService.extractRequirements(body.documentContent, body.projectId);
  }

  @Post('match')
  @ApiOperation({ summary: 'Match requirements to code (Core mode - no auth required)' })
  @ApiResponse({ status: 200, description: 'Requirements matched successfully' })
  @ApiResponse({ status: 404, description: 'Requirement not found' })
  async match(@Body() body: { requirementId: string; projectId?: string }) {
    if (!body.requirementId) {
      throw new Error('requirementId is required');
    }
    return this.requirementsService.matchRequirements(body.requirementId, body.projectId);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify match (Core mode - no auth required)' })
  async verify(@Body() body: { matchId: string; status: string }) {
    if (!body.matchId || !body.status) {
      throw new Error('matchId and status are required');
    }
    return this.requirementsService.verifyMatch(body.matchId, body.status);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get requirements for project (Core mode - no auth required)' })
  async getProjectRequirements(@Param('projectId') projectId: string) {
    return this.requirementsService.getProjectRequirements(projectId);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept a suggestion requirement (Core mode - no auth required)' })
  async acceptSuggestion(@Param('id') id: string) {
    return this.requirementsService.updateRequirementStatus(id, 'accepted');
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a suggestion requirement (Core mode - no auth required)' })
  async rejectSuggestion(@Param('id') id: string) {
    return this.requirementsService.updateRequirementStatus(id, 'rejected');
  }

  // Traceability endpoints
  @Get('traceability/matrix/:projectId')
  @ApiOperation({ summary: 'Generate traceability matrix for project' })
  async getTraceabilityMatrix(@Param('projectId') projectId: string) {
    return this.traceabilityService.generateTraceabilityMatrix(projectId);
  }

  @Get('traceability/requirement/:requirementId')
  @ApiOperation({ summary: 'Get full traceability chain for a requirement' })
  async getRequirementTraceability(@Param('requirementId') requirementId: string) {
    return this.traceabilityService.getRequirementTraceability(requirementId);
  }

  @Get('traceability/impact/:nodeId')
  @ApiOperation({ summary: 'Analyze impact of code changes on requirements' })
  async analyzeImpact(@Param('nodeId') nodeId: string, @Query('projectId') projectId?: string) {
    return this.traceabilityService.analyzeImpact(nodeId, projectId);
  }

  @Get('traceability/export/:projectId')
  @ApiOperation({ summary: 'Export traceability matrix' })
  async exportTraceabilityMatrix(
    @Param('projectId') projectId: string,
    @Query('format') format: 'json' | 'csv' | 'markdown' = 'json'
  ) {
    return this.traceabilityService.exportTraceabilityMatrix(projectId, format);
  }

  // Drift detection endpoints
  @Get('drift/:projectId')
  @ApiOperation({ summary: 'Detect requirements drift for project' })
  async detectDrift(@Param('projectId') projectId: string) {
    return this.driftDetectionService.detectDrift(projectId);
  }

  @Get('drift/requirement/:requirementId')
  @ApiOperation({ summary: 'Check if a specific requirement has drifted' })
  async checkRequirementDrift(@Param('requirementId') requirementId: string) {
    const requirement = await this.requirementsService['prisma'].requirement.findUnique({
      where: { id: requirementId },
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

    return this.driftDetectionService.checkRequirementDrift(requirement);
  }

  // Gap analysis endpoints
  @Get('gaps/:projectId')
  @ApiOperation({ summary: 'Get all gaps (unimplemented requirements) for project' })
  async getGaps(@Param('projectId') projectId: string) {
    return this.gapAnalysisService.getGaps(projectId);
  }

  @Get('gaps/:projectId/priority')
  @ApiOperation({ summary: 'Get high-priority gaps' })
  async getHighPriorityGaps(@Param('projectId') projectId: string) {
    return this.gapAnalysisService.getHighPriorityGaps(projectId);
  }

  @Get('gaps/suggestions/:requirementId')
  @ApiOperation({ summary: 'Generate implementation suggestions for a gap' })
  async getImplementationSuggestions(@Param('requirementId') requirementId: string) {
    return this.gapAnalysisService.generateImplementationSuggestions(requirementId);
  }

  // Compliance endpoints
  @Get('compliance/report/:projectId')
  @ApiOperation({ summary: 'Generate compliance report for project' })
  async generateComplianceReport(
    @Param('projectId') projectId: string,
    @Query('format') format?: 'json' | 'pdf' | 'html' | 'markdown',
    @Query('includeDetails') includeDetails?: boolean
  ) {
    return this.complianceService.generateComplianceReport(projectId, {
      format: format as any,
      includeDetails: includeDetails === true,
    });
  }

  @Get('compliance/validate/:projectId')
  @ApiOperation({ summary: 'Validate compliance for project' })
  async validateCompliance(
    @Param('projectId') projectId: string,
    @Query('standards') standards?: string
  ) {
    const standardsArray = standards ? standards.split(',') : undefined;
    return this.complianceService.validateCompliance(projectId, standardsArray);
  }

  // Versioning endpoints
  @Post('version/:requirementId')
  @ApiOperation({ summary: 'Create a new version of a requirement' })
  async createVersion(
    @Param('requirementId') requirementId: string,
    @Body()
    body: {
      title?: string;
      text?: string;
      type?: string;
      status?: string;
      userId?: string;
    }
  ) {
    return this.versioningService.createVersion(requirementId, body, body.userId);
  }

  @Get('version/history/:requirementId')
  @ApiOperation({ summary: 'Get version history for a requirement' })
  async getVersionHistory(@Param('requirementId') requirementId: string) {
    return this.versioningService.getVersionHistory(requirementId);
  }
}
