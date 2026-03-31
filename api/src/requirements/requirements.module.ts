import { Module } from '@nestjs/common';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';
import { TraceabilityService } from './traceability.service';
import { DriftDetectionService } from './drift-detection.service';
import { GapAnalysisService } from './gap-analysis.service';
import { RequirementsVersioningService } from './requirements-versioning.service';
import { ComplianceService } from './compliance.service';
import { TraceabilityMetricsService } from './traceability-metrics.service';
import {
  HybridMatcher,
  EmbeddingOnlyMatcher,
  TfidfMatcher,
  StructuralOnlyMatcher,
} from './matchers';
import { DatabaseModule } from '../common/database/database.module';
import { TensorModule } from '../common/tensor/tensor.module';
import { SearchModule } from '../search/search.module';
import { QueueModule } from '../common/queue/queue.module';
import { RequirementsWorker } from './requirements.worker';

@Module({
  imports: [DatabaseModule, TensorModule, SearchModule, QueueModule],
  controllers: [RequirementsController],
  providers: [
    HybridMatcher,
    EmbeddingOnlyMatcher,
    TfidfMatcher,
    StructuralOnlyMatcher,
    RequirementsService,
    TraceabilityService,
    TraceabilityMetricsService,
    DriftDetectionService,
    GapAnalysisService,
    RequirementsVersioningService,
    ComplianceService,
    RequirementsWorker,
  ],
  exports: [
    RequirementsService,
    TraceabilityService,
    TraceabilityMetricsService,
    DriftDetectionService,
    GapAnalysisService,
    RequirementsVersioningService,
    ComplianceService,
    RequirementsWorker,
  ],
})
export class RequirementsModule {}
