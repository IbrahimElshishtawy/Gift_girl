import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwtAccessSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  rateLimitWindowSeconds: number;
  rateLimitLoginMax: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  verificationExpirationHours: number;
  passwordResetExpirationMinutes: number;
}

export default registerAs('auth', (): AuthConfig => ({
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_do_not_use_in_production_123456789',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_do_not_use_in_production_987654321',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  rateLimitWindowSeconds: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS || '60', 10),
  rateLimitLoginMax: parseInt(process.env.AUTH_RATE_LIMIT_LOGIN_MAX || '10', 10),
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10),
  verificationExpirationHours: parseInt(process.env.VERIFICATION_EXPIRATION_HOURS || '24', 10),
  passwordResetExpirationMinutes: parseInt(
    process.env.PASSWORD_RESET_EXPIRATION_MINUTES || '30',
    10,
  ),
}));
