/**
 * Auth Service using Better-Auth
 *
 * Note: Most authentication is handled by better-auth's own routes.
 * This service provides helper methods for tenant/user management.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { BetterAuthService } from './better-auth.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly betterAuth: BetterAuthService
  ) {}

  /**
   * Get current user from better-auth session
   * Returns the RepoLens User model with tenant memberships
   */
  async getCurrentUserFromSession(sessionUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUserId },
      include: { tenants: { include: { tenant: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Ensure default tenant exists for a user
   */
  async ensureDefaultTenant(userId: string) {
    let tenant = await this.prisma.tenant.findFirst({
      where: { slug: `user-${userId}` },
    });

    if (!tenant) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      tenant = await this.prisma.tenant.create({
        data: {
          name: `${user?.fullName || user?.email || 'User'}'s Workspace`,
          slug: `user-${userId}`,
        },
      });

      await this.prisma.tenantUser.create({
        data: {
          userId,
          tenantId: tenant.id,
          role: 'USER', // Default role
        },
      });
    }

    return tenant;
  }

  /**
   * Get better-auth handler for Express middleware
   */
  getAuthHandler() {
    return this.betterAuth.getHandler();
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { tenants: { include: { tenant: true } } },
    });
  }
}
