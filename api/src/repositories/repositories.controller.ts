import { Controller, Get, Post, Body, Patch, Param, Delete, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RepositoriesService } from './repositories.service';

@ApiTags('repositories')
@Controller('repositories')
export class RepositoriesController {
  private readonly logger = new Logger(RepositoriesController.name);

  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create repository (Core mode - no auth required)' })
  async create(@Body() createDto: any) {
    const projectId = createDto.projectId;
    this.logger.log(`Creating repository for project: ${projectId}`);
    this.logger.debug(`Repository data:`, JSON.stringify(createDto, null, 2));

    try {
      const repo = await this.repositoriesService.create(projectId, createDto);
      this.logger.log(`Repository created successfully: ${repo.id}`);
      return repo;
    } catch (error) {
      this.logger.error(`Failed to create repository:`, error);
      this.logger.error(error.stack);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List repositories (Core mode - returns all)' })
  async findAll() {
    return this.repositoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repository (Core mode - no auth required)' })
  async findOne(@Param('id') id: string) {
    return this.repositoriesService.findOne(id);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Analyze repository (Core mode - no auth required)' })
  async analyze(@Param('id') id: string) {
    this.logger.log(`Starting analysis`);

    try {
      const result = await this.repositoriesService.analyze(id);
      this.logger.log(`Analysis started successfully for repository: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to analyze repository ${id}:`, error);
      this.logger.error(error.stack);
      throw error;
    }
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sync repository with remote (Core mode - no auth required)' })
  async sync(@Param('id') id: string) {
    const hasUpdates = await this.repositoriesService.checkForUpdates(id);
    if (hasUpdates) {
      return { message: 'Sync started', hasUpdates: true };
    }
    return { message: 'Repository is up to date', hasUpdates: false };
  }
}
