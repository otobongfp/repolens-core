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

  createWorker(name: string, processor: any): Worker {
    if (this.workers.has(name)) {
      return this.workers.get(name)!;
    }

    const worker = new Worker(name, processor, {
      connection: this.redis,
      concurrency: 5,
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
