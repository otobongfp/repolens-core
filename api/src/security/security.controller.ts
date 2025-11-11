import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SecurityService } from './security.service';

@ApiTags('security')
@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('assess/:repoId')
  @ApiOperation({ summary: 'Assess repository security' })
  async assess(@Param('repoId') repoId: string) {
    const tenantId = 'temp-tenant-id'; // TODO: Get from JWT
    return this.securityService.assessSecurity(repoId, tenantId);
  }

  @Post('scan/:repoId')
  @ApiOperation({ summary: 'Scan for vulnerabilities' })
  async scan(@Param('repoId') repoId: string) {
    const tenantId = 'temp-tenant-id'; // TODO: Get from JWT
    return this.securityService.scanVulnerabilities(repoId, tenantId);
  }
}

