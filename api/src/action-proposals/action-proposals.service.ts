import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';

@Injectable()
export class ActionProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(proposalData: any, tenantId: string) {
    return {
      id: 'temp-id',
      status: 'DRAFT',
      ...proposalData,
    };
  }

  async findAll(tenantId: string) {
    return [];
  }

  async findOne(id: string, tenantId: string) {
    return { id, status: 'DRAFT' };
  }

  async approve(id: string, tenantId: string) {
    return { id, status: 'APPROVED' };
  }

  async reject(id: string, tenantId: string) {
    return { id, status: 'REJECTED' };
  }
}

