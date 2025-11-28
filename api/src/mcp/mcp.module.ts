import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { RequirementsModule } from '../requirements/requirements.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ProjectsModule } from '../projects/projects.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [RequirementsModule, RepositoriesModule, ProjectsModule, SearchModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
