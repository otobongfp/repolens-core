import { Controller, Get, Post, Body, Patch, Param, Delete, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from '../shared/dto/projects.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create project (Core mode - no auth required)' })
  async create(@Body() createDto: CreateProjectDto) {
    this.logger.log(`Creating project: ${createDto.name}`);
    this.logger.debug(`Project data:`, JSON.stringify(createDto, null, 2));

    try {
      const project = await this.projectsService.create(createDto);
      this.logger.log(`Project created successfully: ${project.id}`);
      return project;
    } catch (error) {
      this.logger.error(`Failed to create project:`, error);
      this.logger.error(error.stack);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List projects (Core mode - returns all projects)' })
  async findAll() {
    // Core mode: Return all projects
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project (Core mode - no auth required)' })
  async findOne(@Param('id') id: string) {
    // Core mode: No auth required
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project (Core mode - no auth required)' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateProjectDto) {
    // Core mode: No auth required
    return this.projectsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project (Core mode - no auth required)' })
  async remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Analyze project (analyzes all repositories in project)' })
  async analyze(@Param('id') id: string, @Body() body: any) {
    this.logger.log(`Starting analysis for project: ${id}`);

    try {
      const result = await this.projectsService.analyze(id);
      this.logger.log(`Analysis started successfully for project: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to analyze project ${id}:`, error);
      this.logger.error(error.stack);
      throw error;
    }
  }

  @Get(':id/analysis/:analysisId/progress')
  @ApiOperation({ summary: 'Get analysis progress' })
  async getAnalysisProgress(@Param('id') id: string, @Param('analysisId') analysisId: string) {
    return this.projectsService.getAnalysisProgress(id, analysisId);
  }
}
