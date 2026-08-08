import { registerAs } from '@nestjs/config';

export interface SecurityConfig {
  corsAllowedOrigins: string[];
}

export default registerAs(
  'security',
  (): SecurityConfig => ({
    corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '*')
      .split(',')
      .map((origin) => origin.trim()),
  }),
);
