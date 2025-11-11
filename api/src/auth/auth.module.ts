import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BetterAuthService } from './better-auth.service';
import { DatabaseModule } from '../common/database/database.module';
import { ConfigModule } from '../common/config/config.module';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, BetterAuthService],
  exports: [AuthService, BetterAuthService],
})
export class AuthModule {}
