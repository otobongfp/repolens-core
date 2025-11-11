import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { DatabaseModule } from '../common/database/database.module';
import { StorageModule } from '../common/storage/storage.module';
import { S3Module } from '../common/s3/s3.module';
import { QueueModule } from '../common/queue/queue.module';

@Module({
  imports: [DatabaseModule, StorageModule, S3Module, QueueModule],
  controllers: [RepositoriesController],
  providers: [RepositoriesService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
