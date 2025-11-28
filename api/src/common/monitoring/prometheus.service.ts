import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class PrometheusService implements OnModuleInit {
  private readonly logger = new Logger(PrometheusService.name);
  private readonly register = new client.Registry();

  // HTTP Metrics
  public readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [this.register],
  });

  public readonly httpRequestTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [this.register],
  });

  // Queue Metrics
  public readonly queueJobsTotal = new client.Counter({
    name: 'queue_jobs_total',
    help: 'Total number of queue jobs',
    labelNames: ['queue', 'status'],
    registers: [this.register],
  });

  public readonly queueJobDuration = new client.Histogram({
    name: 'queue_job_duration_seconds',
    help: 'Duration of queue jobs in seconds',
    labelNames: ['queue', 'status'],
    buckets: [1, 5, 10, 30, 60, 300],
    registers: [this.register],
  });

  public readonly queueJobsActive = new client.Gauge({
    name: 'queue_jobs_active',
    help: 'Number of active queue jobs',
    labelNames: ['queue'],
    registers: [this.register],
  });

  // Worker Metrics
  public readonly workerProcessedTotal = new client.Counter({
    name: 'worker_processed_total',
    help: 'Total number of items processed by workers',
    labelNames: ['worker', 'status'],
    registers: [this.register],
  });

  public readonly workerProcessingDuration = new client.Histogram({
    name: 'worker_processing_duration_seconds',
    help: 'Duration of worker processing in seconds',
    labelNames: ['worker'],
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
    registers: [this.register],
  });

  // Database Metrics
  public readonly dbQueryDuration = new client.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [this.register],
  });

  public readonly dbConnectionsActive = new client.Gauge({
    name: 'db_connections_active',
    help: 'Number of active database connections',
    registers: [this.register],
  });

  // Embedding Metrics
  public readonly embeddingsGeneratedTotal = new client.Counter({
    name: 'embeddings_generated_total',
    help: 'Total number of embeddings generated',
    labelNames: ['status'],
    registers: [this.register],
  });

  public readonly embeddingGenerationDuration = new client.Histogram({
    name: 'embedding_generation_duration_seconds',
    help: 'Duration of embedding generation in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [this.register],
  });

  // Vector Search Metrics
  public readonly vectorSearchesTotal = new client.Counter({
    name: 'vector_searches_total',
    help: 'Total number of vector searches',
    labelNames: ['status'],
    registers: [this.register],
  });

  public readonly vectorSearchDuration = new client.Histogram({
    name: 'vector_search_duration_seconds',
    help: 'Duration of vector searches in seconds',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
    registers: [this.register],
  });

  // Requirements Metrics
  public readonly requirementsExtractedTotal = new client.Counter({
    name: 'requirements_extracted_total',
    help: 'Total number of requirements extracted',
    registers: [this.register],
  });

  public readonly requirementsMatchedTotal = new client.Counter({
    name: 'requirements_matched_total',
    help: 'Total number of requirements matched',
    labelNames: ['status'],
    registers: [this.register],
  });

  // System Metrics
  public readonly systemInfo = new client.Gauge({
    name: 'system_info',
    help: 'System information',
    labelNames: ['version', 'environment'],
    registers: [this.register],
  });

  onModuleInit() {
    // Register default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({ register: this.register });

    // Set system info
    this.systemInfo.set(
      { version: process.env.npm_package_version || '1.0.0', environment: process.env.NODE_ENV || 'development' },
      1
    );

    this.logger.log('Prometheus metrics initialized');
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get metrics registry
   */
  getRegister(): client.Registry {
    return this.register;
  }
}

