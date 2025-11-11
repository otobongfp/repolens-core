import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { DatabaseModule } from '../common/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SecurityController],
  providers: [SecurityService],
})
export class SecurityModule {}

