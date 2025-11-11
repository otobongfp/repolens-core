import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { DatabaseModule } from '../common/database/database.module';
import { ConfigModule } from '../common/config/config.module';

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

