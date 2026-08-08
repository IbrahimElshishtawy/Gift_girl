import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import * as express from 'express';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Use Pino Logger
  app.useLogger(app.get(PinoLogger));

  // Security Middleware
  app.use(helmet());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS Configuration
  const allowedOrigins = configService.get<string[]>('security.corsAllowedOrigins') || ['*'];
  app.enableCors({
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-correlation-id'],
    credentials: true,
  });

  // Global Prefix
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Graceful Shutdown Hooks
  app.enableShutdownHooks();

  // OpenAPI / Swagger Documentation
  const swaggerEnabled = configService.get<boolean>('app.swaggerEnabled');
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Gift Girl Multi-Vendor Marketplace API')
      .setDescription('Production-Grade Core Infrastructure REST API Specifications')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-request-id', in: 'header' }, 'x-request-id')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log(`Swagger documentation enabled at /${apiPrefix}/docs`);
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
  logger.log(`Application started and listening on port ${port} [Prefix: /${apiPrefix}]`);
}

bootstrap().catch((error) => {
  console.error('Fatal error during application startup:', error);
  process.exit(1);
});
