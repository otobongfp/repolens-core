import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private events: Map<string, QueueEvents> = new Map();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null, // Required by BullMQ
    });

    // Initialize queues
    this.createQueue('webhook-events');
    this.createQueue('fetch-files');
    this.createQueue('parse-files');
    this.createQueue('embed-chunks');
    this.createQueue('resolve-cross-file-refs');
    this.createQueue('match-requirements');
  }

  createQueue(name: string): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.redis,
    });

    this.queues.set(name, queue);
    return queue;
  }

  createWorker(name: string, processor: any, options: { concurrency?: number } = {}): Worker {
    if (this.workers.has(name)) {
      return this.workers.get(name)!;
    }

    const worker = new Worker(name, processor, {
      connection: this.redis,
      concurrency: options.concurrency ?? 5, // Default to 5 if not specified
      lockDuration: 600000, // 10 minutes lock to handle massive project matchings
      stalledInterval: 30000,
      maxStalledCount: 1,
      removeOnComplete: {
        age: 3600,
        count: 10000, // Increased from 1000 to 10000 to show full project progress
      },
      removeOnFail: {
        age: 86400,
      },
    });

    this.workers.set(name, worker);
    return worker;
  }

  async enqueue(queueName: string, jobData: any, options?: any) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(queueName, jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options,
    });

    return job;
  }

  async getQueue(name: string): Promise<Queue> {
    return this.queues.get(name) || this.createQueue(name);
  }

  async getQueueStatus(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
    const counts = await queue.getJobCounts();
    return counts;
  }

  async onModuleDestroy() {
    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
    }

    // Close Redis connection
    await this.redis.quit();
  }
}
