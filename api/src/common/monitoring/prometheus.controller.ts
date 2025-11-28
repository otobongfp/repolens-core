import { Controller, Get } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';

@Controller('metrics')
export class PrometheusController {
  constructor(private readonly prometheusService: PrometheusService) {}

  @Get()
  async getMetrics() {
    const metrics = await this.prometheusService.getMetrics();
    return metrics;
  }
}

