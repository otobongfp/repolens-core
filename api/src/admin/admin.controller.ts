import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('usage/:tenantId')
  @ApiOperation({ summary: 'Get usage metrics' })
  async getUsage(@Param('tenantId') tenantId: string) {
    return this.adminService.getUsageMetrics(tenantId);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'List tenants' })
  async listTenants() {
    return this.adminService.listTenants();
  }
}

