import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { DatabaseModule } from '../common/database/database.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { StorageModule } from '../common/storage/storage.module';
import { S3Module } from '../common/s3/s3.module';

@Module({
  imports: [DatabaseModule, RepositoriesModule, StorageModule, S3Module],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
