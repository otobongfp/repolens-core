import { ProjectStatus } from '@prisma/client';
import { IsString, IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SourceConfigDto {
  @IsEnum(['local', 'github', 'url'])
  type: 'local' | 'github' | 'url';

  @IsOptional()
  @IsString()
  local_path?: string;

  @IsOptional()
  @IsString()
  github_url?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  branch?: string;
}

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceConfigDto)
  source_config?: SourceConfigDto;
}

export class UpdateProjectDto {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export class ProjectResponseDto {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AnalyzeProjectDto {
  projectId: string;
  analysisType: string;
  options?: Record<string, any>;
}
