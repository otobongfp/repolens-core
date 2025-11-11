import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ActionProposalsService } from './action-proposals.service';

@ApiTags('action-proposals')
@Controller('action-proposals')
export class ActionProposalsController {
  constructor(private readonly actionProposalsService: ActionProposalsService) {}

  @Post()
  @ApiOperation({ summary: 'Create action proposal' })
  async create(@Body() body: any) {
    const tenantId = 'temp-tenant-id';
    return this.actionProposalsService.create(body, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get action proposal' })
  async findOne(@Param('id') id: string) {
    const tenantId = 'temp-tenant-id';
    return this.actionProposalsService.findOne(id, tenantId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve proposal' })
  async approve(@Param('id') id: string) {
    const tenantId = 'temp-tenant-id';
    return this.actionProposalsService.approve(id, tenantId);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject proposal' })
  async reject(@Param('id') id: string) {
    const tenantId = 'temp-tenant-id';
    return this.actionProposalsService.reject(id, tenantId);
  }
}

