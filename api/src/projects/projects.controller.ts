import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from '../shared/dto/projects.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create project (Core mode - no auth required)' })
  async create(@Body() createDto: CreateProjectDto) {
    // Core mode: No auth required
    return this.projectsService.create(createDto);
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
    // Core mode: No auth required
    return this.projectsService.remove(id);
  }
}
