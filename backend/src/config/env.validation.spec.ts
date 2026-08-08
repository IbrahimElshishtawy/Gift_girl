import { validateEnv } from './env.validation';

describe('Environment Validation', () => {
  it('should validate valid environment configuration', () => {
    const validConfig = {
      NODE_ENV: 'development',
      PORT: 3000,
      API_PREFIX: 'api',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gift_girl_db',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
    };

    const validated = validateEnv(validConfig);
    expect(validated.PORT).toBe(3000);
    expect(validated.REDIS_HOST).toBe('localhost');
  });

  it('should throw an error when required variables are missing', () => {
    const invalidConfig = {
      NODE_ENV: 'development',
    };

    expect(() => validateEnv(invalidConfig)).toThrow('Environment validation failed');
  });
});
