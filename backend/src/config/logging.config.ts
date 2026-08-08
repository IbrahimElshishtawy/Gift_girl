import { registerAs } from '@nestjs/config';

export interface LoggingConfig {
  level: string;
}

export default registerAs('logging', (): LoggingConfig => ({
  level: process.env.LOG_LEVEL || 'info',
}));
