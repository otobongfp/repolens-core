import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    return {
      ...tenant,
      settings: {},
    };
  }

  async updateSettings(tenantId: string, settings: any) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: settings,
    });
  }
}

