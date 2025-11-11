import { Module, Global } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';
import { ConfigService } from './config.service';

@Global()
@Module({
  providers: [ConfigLoaderService, ConfigService],
  exports: [ConfigLoaderService, ConfigService],
})
export class ConfigModule {}

