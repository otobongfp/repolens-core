import { Controller, Post, Body, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { QueueService } from '../common/queue/queue.service';
import * as crypto from 'crypto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly queueService: QueueService) {}

  @Post('github')
  @ApiOperation({ summary: 'GitHub webhook receiver' })
  async handleGitHubWebhook(@Req() req: Request, @Body() body: any) {
    // Verify signature
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = (req as any).rawBody; // Need raw body middleware

    if (!this.verifyGitHubSignature(rawBody, signature)) {
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

    const event = req.headers['x-github-event'] as string;

    // Enqueue webhook event
    await this.queueService.enqueue('webhook-events', {
      provider: 'github',
      event,
      payload: body,
    });

    return { ok: true };
  }

  @Post('gitlab')
  @ApiOperation({ summary: 'GitLab webhook receiver' })
  async handleGitLabWebhook(@Req() req: Request, @Body() body: any) {
    // Verify token (GitLab uses different auth)
    const token = req.headers['x-gitlab-token'] as string;

    if (!token || token !== process.env.GITLAB_WEBHOOK_SECRET) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    const event = body.object_kind;

    await this.queueService.enqueue('webhook-events', {
      provider: 'gitlab',
      event,
      payload: body,
    });

    return { ok: true };
  }

  private verifyGitHubSignature(payload: string | Buffer, signature: string): boolean {
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET || '');
    hmac.update(payload);

    const expected = `sha256=${hmac.digest('hex')}`;

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
