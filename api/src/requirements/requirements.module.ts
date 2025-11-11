import { Module } from '@nestjs/common';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';
import { DatabaseModule } from '../common/database/database.module';
import { TensorModule } from '../common/tensor/tensor.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [DatabaseModule, TensorModule, SearchModule],
  controllers: [RequirementsController],
  providers: [RequirementsService],
})
export class RequirementsModule {}

