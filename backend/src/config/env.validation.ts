import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  API_PREFIX: string = 'api';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT!: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  REDIS_DB: number = 0;

  @IsString()
  @IsOptional()
  CORS_ALLOWED_ORIGINS: string = '*';

  @IsEnum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsString()
  @IsOptional()
  SWAGGER_ENABLED: string = 'true';

  // JWT & Auth Settings
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET: string = 'dev_jwt_access_secret_do_not_use_in_production_123456789';

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string = 'dev_jwt_refresh_secret_do_not_use_in_production_987654321';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsInt()
  @Min(1)
  @IsOptional()
  AUTH_RATE_LIMIT_WINDOW_SECONDS: number = 60;

  @IsInt()
  @Min(1)
  @IsOptional()
  AUTH_RATE_LIMIT_LOGIN_MAX: number = 5;

  @IsInt()
  @Min(1)
  @IsOptional()
  MAX_LOGIN_ATTEMPTS: number = 5;

  @IsInt()
  @Min(1)
  @IsOptional()
  LOCKOUT_DURATION_MINUTES: number = 15;

  @IsInt()
  @Min(1)
  @IsOptional()
  VERIFICATION_EXPIRATION_HOURS: number = 24;

  @IsInt()
  @Min(1)
  @IsOptional()
  PASSWORD_RESET_EXPIRATION_MINUTES: number = 30;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const formattedErrors = errors
      .map((err) => Object.values(err.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${formattedErrors}`);
  }

  return validatedConfig;
}
