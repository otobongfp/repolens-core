import { Injectable, Logger } from '@nestjs/common';
import { RequirementsService } from './requirements.service';
import { Job } from 'bullmq';

@Injectable()
export class RequirementsWorker {
  private readonly logger = new Logger(RequirementsWorker.name);

  constructor(private readonly requirementsService: RequirementsService) {}

  async process(job: Job) {
    const { projectId, matcherType, options, type } = job.data;
    
    if (type === 'match-all-baselines') {
      this.logger.log(`Processing background ALL BASELINES match job for project ${projectId}`);
      try {
        const result = await this.requirementsService.matchAllBaselines(projectId);
        this.logger.log(`Successfully completed all baseline matches for project ${projectId}`);
        return result;
      } catch (error) {
        this.logger.error(`Failed to process ALL BASELINES match job for project ${projectId}:`, error);
        throw error;
      }
    }

    this.logger.log(`Processing background match job for project ${projectId} (matcher: ${matcherType})`);
    try {
      const result = await this.requirementsService.matchAllRequirements(
        projectId,
        matcherType || 'hybrid',
        options
      );
      this.logger.log(`Successfully matched ${result.matched}/${result.total} requirements for project ${projectId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process background match job for project ${projectId}:`, error);
      throw error;
    }
  }
}
