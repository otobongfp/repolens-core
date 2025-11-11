import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirementsService } from './requirements.service';

@ApiTags('requirements')
@Controller('requirements')
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Post('extract')
  @ApiOperation({ summary: 'Extract requirements from document (Core mode - no auth required)' })
  async extract(@Body() body: { documentContent: string; projectId?: string }) {
    // Core mode: No auth required
    return this.requirementsService.extractRequirements(body.documentContent, body.projectId);
  }

  @Post('match')
  @ApiOperation({ summary: 'Match requirements to code (Core mode - no auth required)' })
  async match(@Body() body: { requirementId: string; projectId?: string }) {
    // Core mode: No auth required
    return this.requirementsService.matchRequirements(body.requirementId, body.projectId);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify match (Core mode - no auth required)' })
  async verify(@Body() body: { matchId: string; status: string }) {
    // Core mode: No auth required
    return this.requirementsService.verifyMatch(body.matchId, body.status);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get requirements for project (Core mode - no auth required)' })
  async getProjectRequirements(@Param('projectId') projectId: string) {
    // Core mode: No auth required
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
}
