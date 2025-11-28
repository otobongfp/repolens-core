import { Module } from '@nestjs/common';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';
import { TraceabilityService } from './traceability.service';
import { DriftDetectionService } from './drift-detection.service';
import { GapAnalysisService } from './gap-analysis.service';
import { RequirementsVersioningService } from './requirements-versioning.service';
import { ComplianceService } from './compliance.service';
import { DatabaseModule } from '../common/database/database.module';
import { TensorModule } from '../common/tensor/tensor.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [DatabaseModule, TensorModule, SearchModule],
  controllers: [RequirementsController],
  providers: [
    RequirementsService,
    TraceabilityService,
    DriftDetectionService,
    GapAnalysisService,
    RequirementsVersioningService,
    ComplianceService,
  ],
  exports: [
    RequirementsService,
    TraceabilityService,
    DriftDetectionService,
    GapAnalysisService,
    RequirementsVersioningService,
    ComplianceService,
  ],
})
export class RequirementsModule {}
