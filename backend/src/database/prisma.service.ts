import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully established connection to PostgreSQL database via Prisma.');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL database during initialization.', error);
      // We don't exit process here directly to allow NestJS health indicator to signal unhealthiness if configured
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing PostgreSQL Prisma connection...');
    await this.$disconnect();
    this.logger.log('PostgreSQL Prisma connection closed.');
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check query failed:', error);
      return false;
    }
  }
}
