import { Module } from '@nestjs/common';
import { GitHubAuthService } from './github-auth.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [GitHubAuthService],
  exports: [GitHubAuthService],
})
export class GitHubAuthModule {}

