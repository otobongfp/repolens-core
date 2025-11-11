import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsageMetrics(tenantId: string) {
    const repos = await this.prisma.repository.count({
      where: { tenantId },
    });

    const projects = await this.prisma.project.count({
      where: { tenantId },
    });

    return {
      tenantId,
      activeRepos: repos,
      projects,
      vectorCount: 0,
      storageBytes: 0,
      apiRequests: 0,
    };
  }

  async listTenants() {
    return this.prisma.tenant.findMany({
      include: {
        users: {
          include: {
            user: true,
          },
        },
        repositories: true,
      },
    });
  }
}

