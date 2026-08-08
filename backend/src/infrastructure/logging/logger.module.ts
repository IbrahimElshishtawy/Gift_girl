import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDev = configService.get<string>('app.nodeEnv') === 'development';
        const level = configService.get<string>('logging.level') || 'info';

        return {
          pinoHttp: {
            level,
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
            customProps: (req: IncomingMessage & { id?: unknown; correlationId?: string }) => ({
              requestId: String(req.id || req.correlationId || 'N/A'),
            }),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'body.password',
                'body.token',
                'body.accessToken',
                'body.refreshToken',
                'body.secret',
                'body.creditCard',
                '*.password',
                '*.token',
                '*.secret',
              ],
              censor: '[REDACTED]',
            },
            serializers: {
              req(req) {
                req.body = req.raw.body;
                return req;
              },
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}
