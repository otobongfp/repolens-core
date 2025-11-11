import { Module, Global } from '@nestjs/common';
import { TensorService } from './tensor.service';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [TensorService],
  exports: [TensorService],
})
export class TensorModule {}

