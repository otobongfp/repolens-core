import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import convict, { Config } from 'convict';
import configSchema from './data/default.schema';
import developmentConfig from './data/development.config';
import productionConfig from './data/production.config';

type SchemaOf<T extends convict.Schema<any>> = T extends convict.Schema<infer R> ? R : any;

const envConfigs: Record<string, any> = {
  development: developmentConfig,
  production: productionConfig,
  test: null, // Use schema defaults only
};

@Injectable()
export class ConfigLoaderService implements OnModuleInit, OnModuleDestroy {
  private config: Config<SchemaOf<typeof configSchema>>;
  private readonly ttl = 300000;
  private configReloadInterval?: NodeJS.Timeout;
  private loadPromise: Promise<void> | null = null;

  constructor() {
    // Initialize config synchronously
    this.loadSync();
  }

  async onModuleInit() {
    // Ensure config is loaded
    if (!this.config) {
      await this.load();
    }

    if (!this.configReloadInterval) {
      this.configReloadInterval = setInterval(async () => {
        await this.load();
      }, this.ttl);
    }
  }

  private loadSync(): void {
    try {
      const config = convict(configSchema);
      
      // Load environment-specific config if it exists
      const envName = process.env.NODE_ENV || 'development';
      const envConfig = envConfigs[envName];
      if (envConfig) {
        config.load(envConfig);
      }

      this.config = config;
      this.config.validate({ allowed: 'warn' });
    } catch (error) {
      console.warn('Failed to load config synchronously, will retry async:', error);
      // Will retry in onModuleInit
    }
  }

  async onModuleDestroy() {
    if (this.configReloadInterval) {
      clearInterval(this.configReloadInterval);
    }
  }

  private async load(): Promise<void> {
    const config = convict(configSchema);

    // Load environment-specific config if it exists (overrides schema defaults)
    const envName = process.env.NODE_ENV || 'development';
    const envConfig = envConfigs[envName];
    if (envConfig) {
      config.load(envConfig);
    }

    this.config = config;
    await this.validate();
  }

  get(key?: string): any {
    if (!this.config) {
      throw new Error('Config not initialized. Call load() first or wait for onModuleInit.');
    }
    return this.config.get(key as any);
  }

  has(key: string): boolean {
    if (!this.config) {
      return false;
    }
    return this.config.has(key as any);
  }

  async validate(): Promise<any> {
    if (!this.config) {
      await this.load();
    }
    return this.config.validate({ allowed: 'warn' });
  }
}
