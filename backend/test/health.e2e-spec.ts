import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication;
  let prismaService: jest.Mocked<Partial<PrismaService>>;
  let redisService: jest.Mocked<Partial<RedisService>>;

  beforeAll(async () => {
    prismaService = {
      isHealthy: jest.fn().mockResolvedValue(true),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    };

    redisService = {
      isHealthy: jest.fn().mockResolvedValue(true),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET) should return 200 OK when services are healthy', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.info.database.status).toBe('up');
    expect(response.body.info.redis.status).toBe('up');
  });

  it('/api/health (GET) should return 503 Service Unavailable when Redis is unhealthy', async () => {
    redisService.isHealthy!.mockResolvedValueOnce(false);

    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(503);

    expect(response.body.status).toBe('error');
    expect(response.body.error.redis.status).toBe('down');
  });
});
