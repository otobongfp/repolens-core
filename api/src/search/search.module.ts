import { Module, forwardRef } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { DatabaseModule } from '../common/database/database.module';
import { ConfigModule } from '../common/config/config.module';
import { TensorModule } from '../common/tensor/tensor.module';
import { CitationModule } from '../common/citation/citation.module';
import { HallucinationModule } from '../common/hallucination/hallucination.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    TensorModule,
    CitationModule,
    forwardRef(() => HallucinationModule),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

