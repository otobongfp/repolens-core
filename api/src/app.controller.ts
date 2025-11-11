import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from './common/config/config.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getRoot() {
    return {
      name: 'RepoLens Core API',
      version: this.configService.getAppVersion(),
      status: 'running',
      mode: 'core-only',
      note: 'Auth, billing, and integrations are not available. Use cloud-api for full SaaS features.',
    };
  }
}
