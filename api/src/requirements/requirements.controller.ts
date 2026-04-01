import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import archiver = require('archiver');
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { RequirementsService } from './requirements.service';
import { TraceabilityService } from './traceability.service';
import { DriftDetectionService } from './drift-detection.service';
import { GapAnalysisService } from './gap-analysis.service';
import { ComplianceService } from './compliance.service';
import { RequirementsVersioningService } from './requirements-versioning.service';
import { TraceabilityMetricsService } from './traceability-metrics.service';

@ApiTags('requirements')
@Controller('requirements')
export class RequirementsController {
  constructor(
    private readonly requirementsService: RequirementsService,
    private readonly traceabilityService: TraceabilityService,
    private readonly traceabilityMetricsService: TraceabilityMetricsService,
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
  async extract(@Body() body: { documentContent: string; projectId?: string; autoMatch?: boolean; matcherType?: string }) {
    if (!body.documentContent) {
      throw new Error('documentContent is required');
    }
    return this.requirementsService.extractRequirements(body.documentContent, body.projectId, {
      autoMatch: body.autoMatch,
      matcherType: body.matcherType as any,
    });
  }

  @Post('extract/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and extract requirements from PDF/DOCX file' })
  @ApiResponse({ status: 200, description: 'Requirements extracted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  async extractFromFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { projectId?: string; autoMatch?: boolean; matcherType?: string }
  ) {
    if (!file) {
      throw new Error('File is required');
    }

    const documentContent = await this.requirementsService.extractTextFromFile(file);
    return this.requirementsService.extractRequirements(documentContent, body.projectId, {
      autoMatch: body.autoMatch === true || (body.autoMatch as any) === 'true',
      matcherType: body.matcherType as any,
    });
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

  @Post('match/all')
  @ApiOperation({ summary: 'Match all requirements for a project (optional matcherType)' })
  @ApiResponse({ status: 200, description: 'All requirements matched successfully' })
  async matchAll(@Body() body: { projectId: string; matcherType?: string }) {
    if (!body.projectId) {
      throw new Error('projectId is required');
    }
    const allowed = ['hybrid', 'embedding', 'tfidf', 'structural-only'];
    const matcherType = body.matcherType && allowed.includes(body.matcherType) ? body.matcherType : 'hybrid';
    return this.requirementsService.matchAllRequirements(body.projectId, matcherType as any);
  }

  @Post('match/all-baselines')
  @ApiOperation({ summary: 'Match all requirements with all four baselines (so Compare and metrics have data for each)' })
  @ApiResponse({ status: 200, description: 'All baselines run; each matcher has stored predictions' })
  async matchAllBaselines(@Body() body: { projectId: string }) {
    if (!body.projectId) {
      throw new Error('projectId is required');
    }
    return this.requirementsService.matchAllBaselines(body.projectId);
  }

  @Post('match/all-all')
  @ApiOperation({ summary: 'Queue matching for all 4 baseline matchers across ALL projects' })
  @ApiResponse({ status: 200, description: 'All projects queued for all-baselines matching' })
  async matchAllAll() {
    return this.requirementsService.enqueueAllProjectsMatchAll();
  }

  @Get('match/queue-status')
  @ApiOperation({ summary: 'Get current status of the background matching queue' })
  async getQueueStatus() {
    return this.requirementsService.getQueueStatus();
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

  @Delete('ground-truth')
  @ApiOperation({ summary: 'Remove one ground truth link' })
  async removeGroundTruth(
    @Query('requirementId') requirementId: string,
    @Query('nodeId') nodeId: string
  ) {
    if (!requirementId || !nodeId) {
      throw new Error('Query requirementId and nodeId are required');
    }
    return this.traceabilityMetricsService.removeGroundTruth(requirementId, nodeId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a requirement (Core mode - no auth required)' })
  async deleteRequirement(@Param('id') id: string) {
    return this.requirementsService.deleteRequirement(id);
  }

  @Delete('project/:projectId')
  @ApiOperation({ summary: 'Delete all requirements for a project (Core mode - no auth required)' })
  async deleteProjectRequirements(@Param('projectId') projectId: string) {
    return this.requirementsService.deleteProjectRequirements(projectId);
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

  // Traceability metrics (precision, recall, F1, coverage) and ground truth
  @Get('metrics/:projectId')
  @ApiOperation({
    summary: 'Get precision, recall, F1, coverage at multiple thresholds (and optimal τ) per matcher',
  })
  @ApiResponse({ status: 200, description: 'Metrics at each threshold + optimal threshold' })
  async getTraceabilityMetrics(
    @Param('projectId') projectId: string,
    @Query('thresholds') thresholdsStr?: string,
    @Query('matcherType') matcherType?: 'hybrid' | 'embedding' | 'tfidf'
  ) {
    const thresholds = thresholdsStr
      ? thresholdsStr.split(',').map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n))
      : [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const allowed = ['hybrid', 'embedding', 'tfidf', 'structural-only'];
    const matcher = matcherType && allowed.includes(matcherType) ? matcherType : 'hybrid';
    return this.traceabilityMetricsService.getMetrics(projectId, thresholds, matcher);
  }

  @Get('metrics/:projectId/at')
  @ApiOperation({ summary: 'Get metrics at a single threshold τ for a matcher type' })
  async getMetricsAtThreshold(
    @Param('projectId') projectId: string,
    @Query('threshold') threshold: string,
    @Query('matcherType') matcherType?: 'hybrid' | 'embedding' | 'tfidf'
  ) {
    const tau = parseFloat(threshold);
    if (Number.isNaN(tau) || tau < 0 || tau > 1) {
      throw new Error('Query "threshold" must be a number in [0, 1]');
    }
    const allowed = ['hybrid', 'embedding', 'tfidf', 'structural-only'];
    const matcher = matcherType && allowed.includes(matcherType) ? matcherType : 'hybrid';
    return this.traceabilityMetricsService.getMetricsAtThreshold(projectId, tau, matcher);
  }

  @Get('metrics/compare/:projectId')
  @ApiOperation({
    summary: 'Compare baselines. Optional query ?threshold=0.3 for fixed τ (all matchers at that τ); otherwise stored Tune test runs.',
  })
  @ApiResponse({ status: 200, description: 'Array of { matcherType, precision, recall, f1, coverage, threshold }' })
  async getMetricsCompare(
    @Param('projectId') projectId: string,
    @Query('threshold') thresholdParam?: string
  ) {
    const threshold = thresholdParam != null ? parseFloat(thresholdParam) : NaN;
    if (!Number.isNaN(threshold) && threshold >= 0 && threshold <= 1) {
      return this.traceabilityMetricsService.getCompareAtThreshold(projectId, threshold);
    }
    return this.traceabilityMetricsService.getCompare(projectId);
  }

  @Get('metrics/compare-by-repo/:repoId')
  @ApiOperation({ summary: 'Side-by-side comparison of all matcher types for a repository (from TraceabilityExperimentResult)' })
  @ApiResponse({ status: 200, description: 'Array of { matcherType, threshold, precision, recall, f1, coverage, tp, fp, fn }' })
  async getCompareByRepo(@Param('repoId') repoId: string) {
    return this.traceabilityMetricsService.getCompareForRepo(repoId);
  }

  @Post('metrics/:projectId/tune')
  @ApiOperation({ summary: 'Run threshold tuning for one matcher; persist validation + test EvaluationRun at τ*' })
  async runThresholdTuning(
    @Param('projectId') projectId: string,
    @Body() body: { matcherType?: string }
  ) {
    const allowed = ['hybrid', 'embedding', 'tfidf', 'structural-only'];
    const matcher = body?.matcherType && allowed.includes(body.matcherType) ? body.matcherType : 'hybrid';
    return this.traceabilityMetricsService.runThresholdTuning(projectId, matcher as any);
  }

  @Post('metrics/:projectId/tune-all')
  @ApiOperation({ summary: 'Run threshold tuning for all matchers (tfidf, embedding, structural-only, hybrid); returns diagnostic table' })
  async runAllMatchersTuning(@Param('projectId') projectId: string) {
    return this.traceabilityMetricsService.runAllMatchersTuning(projectId);
  }

  @Post('metrics/:projectId/experiment')
  @ApiOperation({ summary: 'Run one experiment config (ablation); persist to TraceabilityExperimentResult' })
  async runExperimentConfig(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      matcherType: string;
      threshold: number;
      useGraphPropagation: boolean;
      useSymbolMatching: boolean;
    }
  ) {
    if (
      body.matcherType == null ||
      body.threshold == null ||
      body.useGraphPropagation == null ||
      body.useSymbolMatching == null
    ) {
      throw new Error('matcherType, threshold, useGraphPropagation, useSymbolMatching are required');
    }
    return this.traceabilityMetricsService.runExperimentConfig(projectId, {
      matcherType: body.matcherType as any,
      threshold: body.threshold,
      useGraphPropagation: body.useGraphPropagation,
      useSymbolMatching: body.useSymbolMatching,
    });
  }

  @Get('metrics/experiment-runs')
  @ApiOperation({ summary: 'List experiment runs for plotting (project-level, all or by projectId)' })
  async listExperimentRuns(@Query('projectId') projectId?: string) {
    return this.traceabilityMetricsService.listExperimentRuns(projectId ?? undefined);
  }

  @Get('metrics/compare-experiments')
  @ApiOperation({ summary: 'Compare two methods for a repo (for paired t-test)' })
  async compareExperiments(
    @Query('repoId') repoId: string,
    @Query('methodA') methodA: string,
    @Query('methodB') methodB: string
  ) {
    if (!repoId || !methodA || !methodB) {
      throw new Error('repoId, methodA, methodB query params are required');
    }
    return this.traceabilityMetricsService.compareExperiments(repoId, methodA as any, methodB as any);
  }

  @Get('ground-truth/:projectId')
  @ApiOperation({ summary: 'List all ground truth links for a project' })
  async listGroundTruth(@Param('projectId') projectId: string) {
    return this.traceabilityMetricsService.listGroundTruth(projectId);
  }

  @Post('ground-truth/:projectId')
  @ApiOperation({ summary: 'Add one ground truth link (requirement ↔ code element)' })
  async addGroundTruth(
    @Param('projectId') projectId: string,
    @Body() body: { requirementId: string; nodeId: string; source?: string; notes?: string }
  ) {
    if (!body.requirementId || !body.nodeId) {
      throw new Error('requirementId and nodeId are required');
    }
    return this.traceabilityMetricsService.addGroundTruth(
      projectId,
      body.requirementId,
      body.nodeId,
      { source: body.source, notes: body.notes }
    );
  }

  @Post('ground-truth/:projectId/bulk')
  @ApiOperation({ summary: 'Bulk add ground truth links' })
  async bulkAddGroundTruth(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      links: Array<{
        requirementId: string;
        nodeId: string;
        source?: string;
        notes?: string;
      }>;
    }
  ) {
    if (!body.links || !Array.isArray(body.links)) {
      throw new Error('body.links array is required');
    }
    return this.traceabilityMetricsService.bulkAddGroundTruth(projectId, body.links);
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
    try {
      const requirement = await this.requirementsService['prisma'].requirement.findUnique({
        where: { id: requirementId },
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
      });

      if (!requirement) {
        throw new Error('Requirement not found');
      }

      return this.driftDetectionService.checkRequirementDrift(requirement);
    } catch (error: any) {
      if (error.code === 'P1001' || error.message?.includes("Can't reach database server")) {
        throw new Error(
          'Database connection failed. Please check your database connection settings and ensure the database server is running.'
        );
      }
      throw error;
    }
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

  // --- Metrics Export Endpoints ---

  @Get('metrics/export-all')
  @ApiOperation({ summary: 'Get metrics for all projects and matchers (JSON)' })
  async getAllMetrics(@Query('thresholds') thresholds?: string) {
    const thresholdArray = thresholds
      ? thresholds.split(',').map(Number).filter((t) => !isNaN(t))
      : undefined;
    return this.traceabilityMetricsService.getAllProjectsMetrics(thresholdArray);
  }

  @Get('metrics/export-all/zip')
  @ApiOperation({ summary: 'Export metrics for all projects and matchers (ZIP)' })
  async exportAllMetricsZip(@Res() res: Response, @Query('thresholds') thresholds?: string) {
    const thresholdArray = thresholds
      ? thresholds.split(',').map(Number).filter((t) => !isNaN(t))
      : undefined;

    const rows = await this.traceabilityMetricsService.getAllProjectsMetrics(thresholdArray);

    if (rows.length === 0) {
      res.status(204).send();
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=repolens_all_metrics.zip');

    const archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    });

    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: err.message });
      }
    });

    archive.pipe(res);

    // Group by projectId. Assumes that 'projectId' is returned directly or you can map by 'projectName'.
    // If we only have 'projectName', we use that for the folder name.
    const byProject = new Map<string, any[]>();
    for (const row of rows) {
      const pName = row.projectName ?? 'Unknown_Project';
      let pGroup = byProject.get(pName);
      if (!pGroup) {
        pGroup = [];
        byProject.set(pName, pGroup);
      }
      pGroup.push(row);
    }

    for (const [pName, pRows] of byProject.entries()) {
      const sanitizedProjectName = pName.replace(/[^a-z0-9_-]/gi, '_');
      
      const byMatcher = new Map<string, any[]>();
      for (const row of pRows) {
        const mType = row.matcherType ?? 'unknown';
        let mGroup = byMatcher.get(mType);
        if (!mGroup) {
          mGroup = [];
          byMatcher.set(mType, mGroup);
        }
        mGroup.push(row);
      }

      for (const [mType, mRows] of byMatcher.entries()) {
        const headers = Object.keys(mRows[0]).join(',');
        const csvContent = mRows
          .map((row) =>
            Object.values(row)
              .map((val) => (typeof val === 'string' && val.includes(',') ? `"${val}"` : val))
              .join(',')
          )
          .join('\n');
        
        const fileData = `${headers}\n${csvContent}`;
        archive.append(fileData, { name: `${sanitizedProjectName}/${mType}.csv` });
      }
    }

    await archive.finalize();
  }
}
