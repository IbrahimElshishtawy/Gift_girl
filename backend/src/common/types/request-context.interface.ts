import { Request } from 'express';

export interface AppRequest extends Request {
  id?: string;
  correlationId?: string;
  startTime?: number;
}
