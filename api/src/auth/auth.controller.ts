import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { BetterAuthService } from './better-auth.service';

/**
 * Auth Controller
 *
 * Better-auth handles authentication routes automatically via middleware in main.ts.
 * Routes like POST /auth/sign-up, POST /auth/sign-in, POST /auth/sign-out, GET /auth/session, etc.
 * are handled by better-auth directly.
 *
 * This controller only handles custom routes that extend better-auth functionality.
 */
@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly betterAuth: BetterAuthService
  ) {}

  /**
   * Get current user with tenant information
   * This extends better-auth's session endpoint with RepoLens-specific data
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current user with tenant info' })
  @ApiBearerAuth()
  async getCurrentUser(@Req() req: Request) {
    // Get session from better-auth
    // Better-auth adds session to req object via middleware
    const auth = this.betterAuth.getAuthInstance();

    try {
      // Call better-auth's session API internally
      const sessionResult = await auth.api.getSession({
        headers: req.headers as Record<string, string>,
      });

      if (!sessionResult?.user) {
        throw new UnauthorizedException('No active session');
      }

      const userId = sessionResult.user.id;

      // Get user with tenants from RepoLens database
      const user = await this.authService.getCurrentUserFromSession(userId);

      // Ensure default tenant exists
      await this.authService.ensureDefaultTenant(userId);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.fullName,
          username: user.username,
          avatarUrl: user.avatarUrl,
          isVerified: user.isVerified,
          role: user.role,
        },
        tenants: user.tenants.map((tu) => ({
          id: tu.tenant.id,
          name: tu.tenant.name,
          slug: tu.tenant.slug,
          role: tu.role,
        })),
        session: {
          userId: sessionResult.user.id,
          expiresAt: sessionResult.session?.expiresAt,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to get current user');
    }
  }
}
