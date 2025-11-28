import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { TraceabilityService } from './traceability.service';
import { RequirementsService } from './requirements.service';

/**
 * Compliance Service
 * Generates compliance reports and validates requirements coverage
 */
@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly traceabilityService: TraceabilityService,
    private readonly requirementsService: RequirementsService
  ) {}

  /**
   * Generate compliance report for a project
   */
  async generateComplianceReport(
    projectId: string,
    options?: {
      format?: 'json' | 'pdf' | 'html' | 'markdown';
      includeDetails?: boolean;
    }
  ) {
    this.logger.log(`Generating compliance report for project ${projectId}`);

    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          requirements: {
            include: {
              requirementMatches: {
                include: {
                  node: true,
                },
              },
            },
          },
        },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Get traceability matrix
      const traceability = await this.traceabilityService.generateTraceabilityMatrix(projectId);

      // Get completeness metrics
      const requirements = await this.requirementsService.getProjectRequirements(projectId);

      // Calculate compliance metrics
      const complianceMetrics = this.calculateComplianceMetrics(project.requirements, traceability);

      const report = {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
        },
        generatedAt: new Date().toISOString(),
        complianceMetrics,
        traceability: options?.includeDetails ? traceability : traceability.summary,
        requirements: options?.includeDetails
          ? requirements
          : {
              count: requirements.count,
              completionMetrics: requirements.completionMetrics,
            },
        recommendations: this.generateRecommendations(complianceMetrics),
      };

      // Save compliance report to database
      const savedReport = await this.prisma.complianceReport.create({
        data: {
          projectId,
          reportType: options?.format || 'standards',
          overallCompliance: complianceMetrics.overallCompliance,
          requirementsCoverage: complianceMetrics.requirementsCoverage,
          traceabilityComplete: complianceMetrics.traceabilityComplete,
          allRequirementsTracked: complianceMetrics.allRequirementsTracked,
          metrics: complianceMetrics as any,
          recommendations: this.generateRecommendations(complianceMetrics) as any,
        },
      });

      // Format report based on requested format
      if (options?.format === 'markdown') {
        return this.formatAsMarkdown(report);
      } else if (options?.format === 'html') {
        return this.formatAsHTML(report);
      }

      return {
        ...report,
        id: savedReport.id,
        savedAt: savedReport.generatedAt,
      };
    } catch (error) {
      this.logger.error('Failed to generate compliance report:', error);
      throw new Error(
        'Failed to generate compliance report: ' +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Validate requirements coverage for compliance standards
   */
  async validateCompliance(projectId: string, standards?: string[]) {
    this.logger.log(`Validating compliance for project ${projectId}`);

    const report = await this.generateComplianceReport(projectId, { includeDetails: true });

    // Type guard: ensure report is an object, not a string
    if (typeof report === 'string') {
      throw new Error('Compliance report returned as string format, expected object');
    }

    const validations = {
      overallCompliance: report.complianceMetrics.overallCompliance >= 80,
      requirementsCoverage: report.complianceMetrics.requirementsCoverage >= 90,
      traceabilityComplete: report.complianceMetrics.traceabilityComplete,
      allRequirementsTracked: report.complianceMetrics.allRequirementsTracked,
    };

    const isCompliant = Object.values(validations).every((v) => v === true);

    return {
      projectId,
      isCompliant,
      validations,
      metrics: report.complianceMetrics,
      issues: isCompliant ? [] : this.identifyComplianceIssues(report),
    };
  }

  private calculateComplianceMetrics(requirements: any[], traceability: any): any {
    const total = requirements.length;
    const accepted = requirements.filter((r) => r.status === 'accepted').length;
    const withMatches = requirements.filter((r) => r.requirementMatches.length > 0).length;
    const verified = requirements.filter((r) =>
      r.requirementMatches.some((m: any) => m.matchTypes.includes('verified'))
    ).length;

    return {
      overallCompliance: traceability.summary.overallCompletion,
      requirementsCoverage: total > 0 ? Math.round((withMatches / total) * 100) : 0,
      traceabilityComplete: verified === accepted && accepted > 0,
      allRequirementsTracked: withMatches === accepted && accepted > 0,
      totalRequirements: total,
      acceptedRequirements: accepted,
      trackedRequirements: withMatches,
      verifiedRequirements: verified,
    };
  }

  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.overallCompliance < 80) {
      recommendations.push(
        'Overall compliance is below 80%. Focus on implementing missing requirements.'
      );
    }

    if (metrics.requirementsCoverage < 90) {
      recommendations.push(
        'Requirements coverage is below 90%. Ensure all accepted requirements are matched to code.'
      );
    }

    if (!metrics.traceabilityComplete) {
      recommendations.push(
        'Not all requirements are verified. Review and verify requirement matches.'
      );
    }

    if (metrics.verifiedRequirements < metrics.acceptedRequirements) {
      recommendations.push(
        `${metrics.acceptedRequirements - metrics.verifiedRequirements} requirements need verification.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Project meets compliance standards. Maintain current practices.');
    }

    return recommendations;
  }

  private identifyComplianceIssues(report: any): string[] {
    const issues: string[] = [];

    if (report.complianceMetrics.overallCompliance < 80) {
      issues.push('Low overall compliance percentage');
    }

    if (report.complianceMetrics.requirementsCoverage < 90) {
      issues.push('Incomplete requirements coverage');
    }

    if (!report.complianceMetrics.traceabilityComplete) {
      issues.push('Traceability not fully verified');
    }

    return issues;
  }

  private formatAsMarkdown(report: any): string {
    let markdown = `# Compliance Report\n\n`;
    markdown += `**Project:** ${report.project.name}\n`;
    markdown += `**Generated:** ${report.generatedAt}\n\n`;
    markdown += `## Compliance Metrics\n\n`;
    markdown += `- Overall Compliance: ${report.complianceMetrics.overallCompliance}%\n`;
    markdown += `- Requirements Coverage: ${report.complianceMetrics.requirementsCoverage}%\n`;
    markdown += `- Traceability Complete: ${report.complianceMetrics.traceabilityComplete ? 'Yes' : 'No'}\n`;
    markdown += `- All Requirements Tracked: ${report.complianceMetrics.allRequirementsTracked ? 'Yes' : 'No'}\n\n`;
    markdown += `## Recommendations\n\n`;
    report.recommendations.forEach((rec: string) => {
      markdown += `- ${rec}\n`;
    });
    return markdown;
  }

  private formatAsHTML(report: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Compliance Report - ${report.project.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .metric { margin: 10px 0; padding: 10px; background: #f5f5f5; }
          .recommendation { margin: 5px 0; padding: 5px; }
        </style>
      </head>
      <body>
        <h1>Compliance Report</h1>
        <h2>${report.project.name}</h2>
        <p>Generated: ${report.generatedAt}</p>
        <h3>Compliance Metrics</h3>
        <div class="metric">Overall Compliance: ${report.complianceMetrics.overallCompliance}%</div>
        <div class="metric">Requirements Coverage: ${report.complianceMetrics.requirementsCoverage}%</div>
        <h3>Recommendations</h3>
        ${report.recommendations.map((rec: string) => `<div class="recommendation">${rec}</div>`).join('')}
      </body>
      </html>
    `;
  }
}
