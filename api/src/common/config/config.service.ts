import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';

@Injectable()
export class ConfigService {
  constructor(private readonly config: ConfigLoaderService) { }
  
  getAppName(): string {
    return this.config.get('app.name');
  }

  getAppVersion(): string {
    return this.config.get('app.version');
  }

  getEnv(): string {
    return this.config.get('env');
  }

  getPort(): number {
    return this.config.get('port');
  }

  getDatabaseUrl(): string {
    return this.config.get('database.url');
  }

  getRedisUrl(): string {
    return this.config.get('redis.url');
  }

  getPythonAiServiceUrl(): string {
    return this.config.get('python.aiServiceUrl');
  }

  getCorsOrigins(): string[] {
    const origins = this.config.get('cors.origins');
    if (typeof origins === 'string') {
      return origins.split(',').map((o) => o.trim());
    }
    return origins || ['http://localhost:3000'];
  }

  isDevelopment(): boolean {
    return this.getEnv() === 'development';
  }
}

