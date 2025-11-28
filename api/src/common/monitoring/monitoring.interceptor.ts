import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrometheusService } from './prometheus.service';

@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(private readonly prometheus: PrometheusService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    const route = request.route?.path || request.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - startTime) / 1000;
          const status = response.statusCode;

          this.prometheus.httpRequestDuration.observe(
            { method, route, status: status.toString() },
            duration
          );
          this.prometheus.httpRequestTotal.inc({
            method,
            route,
            status: status.toString(),
          });
        },
        error: (error) => {
          const duration = (Date.now() - startTime) / 1000;
          const status = error.status || 500;

          this.prometheus.httpRequestDuration.observe(
            { method, route, status: status.toString() },
            duration
          );
          this.prometheus.httpRequestTotal.inc({
            method,
            route,
            status: status.toString(),
          });
        },
      })
    );
  }
}

