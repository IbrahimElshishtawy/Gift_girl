import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  prefix: string;
  defaultAttempts: number;
  backoffDelay: number;
}

export default registerAs('queue', (): QueueConfig => ({
  prefix: 'gift_girl_queue',
  defaultAttempts: 3,
  backoffDelay: 1000,
}));
