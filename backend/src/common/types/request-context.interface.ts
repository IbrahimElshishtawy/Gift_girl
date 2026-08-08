import { Request } from 'express';

export interface AppRequest extends Omit<Request, 'id'> {
  id?: string;
  correlationId?: string;
  startTime?: number;
}
