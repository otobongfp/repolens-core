import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../common/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}

