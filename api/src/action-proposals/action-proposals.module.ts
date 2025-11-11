import { Module } from '@nestjs/common';
import { ActionProposalsController } from './action-proposals.controller';
import { ActionProposalsService } from './action-proposals.service';
import { DatabaseModule } from '../common/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ActionProposalsController],
  providers: [ActionProposalsService],
})
export class ActionProposalsModule {}

