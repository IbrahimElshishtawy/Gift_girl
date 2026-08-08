import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue, Worker, Processor, QueueOptions, WorkerOptions } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import queueConfig from '../../config/queue.config';

@Injectable()
export class QueueFactoryService {
  private readonly logger = new Logger(QueueFactoryService.name);
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Map<string, Worker> = new Map();

  constructor(
    private readonly redisService: RedisService,
    @Inject(queueConfig.KEY)
    private readonly config: ConfigType<typeof queueConfig>,
  ) {}

  createQueue(name: string, options?: Partial<QueueOptions>): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const connection = this.redisService.getClientOptions();
    const queue = new Queue(name, {
      prefix: this.config.prefix,
      connection,
      defaultJobOptions: {
        attempts: this.config.defaultAttempts,
        backoff: {
          type: 'exponential',
          delay: this.config.backoffDelay,
        },
        removeOnComplete: {
          age: 3600 * 24, // keep for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 3600 * 24 * 7, // keep for 7 days
          count: 5000,
        },
      },
      ...options,
    });

    this.queues.set(name, queue);
    this.logger.log(`BullMQ Queue created: ${name}`);
    return queue;
  }

  createWorker(
    name: string,
    processor: Processor,
    options?: Partial<WorkerOptions>,
  ): Worker {
    if (this.workers.has(name)) {
      return this.workers.get(name)!;
    }

    const connection = this.redisService.getClientOptions();
    const worker = new Worker(name, processor, {
      prefix: this.config.prefix,
      connection,
      autorun: true,
      ...options,
    });

    worker.on('failed', (job, err) => {
      this.logger.error(
        `Job ${job?.id} failed in queue ${name}: ${err.message}`,
        err.stack,
      );
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error in queue ${name}: ${err.message}`, err.stack);
    });

    this.workers.set(name, worker);
    this.logger.log(`BullMQ Worker created for queue: ${name}`);
    return worker;
  }

  async closeAll(): Promise<void> {
    this.logger.log('Closing all BullMQ queues and workers...');
    for (const [name, worker] of this.workers.entries()) {
      this.logger.log(`Closing worker: ${name}`);
      await worker.close();
    }
    for (const [name, queue] of this.queues.entries()) {
      this.logger.log(`Closing queue: ${name}`);
      await queue.close();
    }
    this.queues.clear();
    this.workers.clear();
    this.logger.log('All BullMQ queues and workers closed.');
  }
}
