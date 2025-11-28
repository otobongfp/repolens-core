import { Module } from '@nestjs/common';
import { PrometheusModule } from './prometheus.module';
import { PrometheusController } from './prometheus.controller';

@Module({
  imports: [PrometheusModule],
  controllers: [PrometheusController],
  exports: [PrometheusModule],
})
export class MonitoringModule {}

