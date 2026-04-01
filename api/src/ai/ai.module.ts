import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { ConfigModule } from '../common/config/config.module';
import { TensorModule } from '../common/tensor/tensor.module';
import { SearchModule } from '../search/search.module';
import { DatabaseModule } from '../common/database/database.module';
import { HallucinationModule } from '../common/hallucination/hallucination.module';

@Module({
  imports: [ConfigModule, TensorModule, SearchModule, DatabaseModule, HallucinationModule],
  controllers: [AIController],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
