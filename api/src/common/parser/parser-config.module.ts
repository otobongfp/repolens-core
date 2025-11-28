import { Module, Global } from '@nestjs/common';
import { ParserConfigService } from './parser-config.service';

@Global()
@Module({
  providers: [ParserConfigService],
  exports: [ParserConfigService],
})
export class ParserConfigModule {}

