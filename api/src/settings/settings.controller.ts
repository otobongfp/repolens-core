import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get settings' })
  async getSettings() {
    const tenantId = 'temp-tenant-id';
    return this.settingsService.getSettings(tenantId);
  }

  @Put()
  @ApiOperation({ summary: 'Update settings' })
  async updateSettings(@Body() body: any) {
    const tenantId = 'temp-tenant-id';
    return this.settingsService.updateSettings(tenantId, body);
  }
}

