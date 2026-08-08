import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AppRequest } from '../types/request-context.interface';

export const CORRELATION_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: AppRequest, res: Response, next: NextFunction): void {
    const existingId =
      (req.headers[REQUEST_ID_HEADER] as string) ||
      (req.headers[CORRELATION_HEADER] as string);

    const requestId = existingId && existingId.trim().length > 0
      ? existingId.trim()
      : randomUUID();

    req.id = requestId;
    req.correlationId = requestId;
    req.startTime = Date.now();

    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.setHeader(CORRELATION_HEADER, requestId);

    next();
  }
}
