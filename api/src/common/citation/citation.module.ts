import { Module } from '@nestjs/common';
import { CitationService } from './citation.service';
import { DatabaseModule } from '../database/database.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [DatabaseModule, S3Module],
  providers: [CitationService],
  exports: [CitationService],
})
export class CitationModule {}

