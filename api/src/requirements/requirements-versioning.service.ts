import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';

/**
 * Requirements Versioning Service
 * Tracks changes to requirements over time
 */
@Injectable()
export class RequirementsVersioningService {
  private readonly logger = new Logger(RequirementsVersioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new version of a requirement
   */
  async createVersion(
    requirementId: string,
    changes: {
      title?: string;
      text?: string;
      type?: string;
      status?: string;
    },
    userId?: string
  ) {
    this.logger.log(`Creating version for requirement ${requirementId}`);

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    // Get current version number
    const existingVersions = await this.prisma.requirementVersion.findMany({
      where: { requirementId },
      orderBy: { versionNumber: 'desc' },
      take: 1,
    });

    const nextVersionNumber =
      existingVersions.length > 0 ? existingVersions[0].versionNumber + 1 : 1;

    // Generate change summary
    const changesList: string[] = [];
    if (changes.title && changes.title !== requirement.title) {
      changesList.push(`Title changed from "${requirement.title}" to "${changes.title}"`);
    }
    if (changes.text && changes.text !== requirement.text) {
      changesList.push('Text content updated');
    }
    if (changes.type && changes.type !== requirement.type) {
      changesList.push(`Type changed from "${requirement.type}" to "${changes.type}"`);
    }
    if (changes.status && changes.status !== requirement.status) {
      changesList.push(`Status changed from "${requirement.status}" to "${changes.status}"`);
    }

    const changeSummary = changesList.join('; ');

    // Create version record before updating requirement
    const version = await this.prisma.requirementVersion.create({
      data: {
        requirementId,
        versionNumber: nextVersionNumber,
        title: requirement.title, // Store previous version
        text: requirement.text,
        changeSummary: changeSummary || null,
        changedBy: userId || null,
      },
    });

    // Update requirement
    const updated = await this.prisma.requirement.update({
      where: { id: requirementId },
      data: {
        title: changes.title ?? requirement.title,
        text: changes.text ?? requirement.text,
        type: changes.type ?? requirement.type,
        status: changes.status ?? requirement.status,
      },
    });

    return {
      requirement: updated,
      version,
    };
  }

  /**
   * Get version history for a requirement
   */
  async getVersionHistory(requirementId: string) {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    const versions = await this.prisma.requirementVersion.findMany({
      where: { requirementId },
      include: {
        changedByUser: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });

    return {
      requirementId,
      currentVersion: {
        title: requirement.title,
        text: requirement.text,
        type: requirement.type,
        status: requirement.status,
        updatedAt: requirement.updatedAt,
      },
      versions: versions.map((v) => ({
        versionNumber: v.versionNumber,
        title: v.title,
        text: v.text,
        changeSummary: v.changeSummary,
        changedBy: v.changedByUser
          ? {
              id: v.changedByUser.id,
              email: v.changedByUser.email,
              fullName: v.changedByUser.fullName,
            }
          : null,
        createdAt: v.createdAt,
      })),
    };
  }

  /**
   * Compare two versions of a requirement
   */
  async compareVersions(requirementId: string, version1: number, version2: number) {
    const [v1, v2] = await Promise.all([
      this.prisma.requirementVersion.findUnique({
        where: {
          requirementId_versionNumber: {
            requirementId,
            versionNumber: version1,
          },
        },
      }),
      this.prisma.requirementVersion.findUnique({
        where: {
          requirementId_versionNumber: {
            requirementId,
            versionNumber: version2,
          },
        },
      }),
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const differences: string[] = [];
    if (v1.title !== v2.title) {
      differences.push(`Title: "${v1.title}" → "${v2.title}"`);
    }
    if (v1.text !== v2.text) {
      differences.push('Text content changed');
    }

    return {
      requirementId,
      version1: {
        versionNumber: v1.versionNumber,
        title: v1.title,
        text: v1.text,
        createdAt: v1.createdAt,
      },
      version2: {
        versionNumber: v2.versionNumber,
        title: v2.title,
        text: v2.text,
        createdAt: v2.createdAt,
      },
      differences,
    };
  }
}
