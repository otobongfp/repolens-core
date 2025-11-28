import { Module, forwardRef } from '@nestjs/common';
import { HallucinationDetectionService } from './hallucination-detection.service';
import { DatabaseModule } from '../database/database.module';
import { SearchModule } from '../../search/search.module';
import { CitationModule } from '../citation/citation.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => SearchModule),
    CitationModule,
  ],
  providers: [HallucinationDetectionService],
  exports: [HallucinationDetectionService],
})
export class HallucinationModule {}

