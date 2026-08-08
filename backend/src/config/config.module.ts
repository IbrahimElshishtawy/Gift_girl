import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import securityConfig from './security.config';
import loggingConfig from './logging.config';
import queueConfig from './queue.config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, securityConfig, loggingConfig, queueConfig],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
})
export class AppConfigModule {}
