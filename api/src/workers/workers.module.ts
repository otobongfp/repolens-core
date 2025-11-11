import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { QueueModule } from '../common/queue/queue.module';
import { S3Module } from '../common/s3/s3.module';
import { TensorModule } from '../common/tensor/tensor.module';
import { FetcherWorker } from './fetcher.worker';
import { ParserWorker } from './parser.worker';
import { EmbeddingWorker } from './embedding.worker';

@Module({
  imports: [DatabaseModule, QueueModule, S3Module, TensorModule],
  providers: [FetcherWorker, ParserWorker, EmbeddingWorker],
  exports: [FetcherWorker, ParserWorker, EmbeddingWorker],
})
export class WorkersModule {}

