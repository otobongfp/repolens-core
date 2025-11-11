import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RepositoriesService } from './repositories.service';

@ApiTags('repositories')
@Controller('repositories')
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create repository (Core mode - no auth required)' })
  async create(@Body() createDto: any) {
    const projectId = createDto.projectId;
    // Core mode: No auth required, use system tenant
    return this.repositoriesService.create(projectId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List repositories (Core mode - returns all)' })
  async findAll() {
    // Core mode: Return all repositories
    return this.repositoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repository (Core mode - no auth required)' })
  async findOne(@Param('id') id: string) {
    // Core mode: No auth required
    return this.repositoriesService.findOne(id);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Analyze repository (Core mode - no auth required)' })
  async analyze(@Param('id') id: string) {
    // Core mode: No auth required
    return this.repositoriesService.analyze(id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sync repository with remote (Core mode - no auth required)' })
  async sync(@Param('id') id: string) {
    // Core mode: No auth required
    const hasUpdates = await this.repositoriesService.checkForUpdates(id);
    if (hasUpdates) {
      // TODO: Trigger sync process
      return { message: 'Sync started', hasUpdates: true };
    }
    return { message: 'Repository is up to date', hasUpdates: false };
  }
}
