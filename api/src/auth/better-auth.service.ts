/**
 * Better-Auth Service Integration
 * Handles authentication using better-auth library
 *
 * Note: Better-auth requires specific Prisma tables. See schema.prisma for better-auth models.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

@Injectable()
export class BetterAuthService {
  private auth: ReturnType<typeof betterAuth>;

  constructor(private readonly prisma: PrismaService) {
    // Initialize better-auth with Prisma adapter
    this.auth = betterAuth({
      database: prismaAdapter(this.prisma, {
        provider: 'postgresql',
      }),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // Set to true in production
      },
      socialProviders: {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID || '',
          clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        },
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        },
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
      },
      trustedOrigins: [process.env.FRONTEND_URL || 'http://localhost:3000'],
    });
  }

  getAuthInstance() {
    return this.auth;
  }

  /**
   * Get the better-auth handler for Express middleware
   * Use this in a controller to handle better-auth routes
   */
  getHandler() {
    return this.auth.handler;
  }
}
