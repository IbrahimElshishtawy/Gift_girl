import { CorrelationIdMiddleware, REQUEST_ID_HEADER } from './correlation-id.middleware';
import { AppRequest } from '../types/request-context.interface';
import { Response } from 'express';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should generate a new request ID if none provided in headers', () => {
    const req = {
      headers: {},
    } as unknown as AppRequest;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.id).toBeDefined();
    expect(req.correlationId).toBe(req.id);
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.id);
    expect(next).toHaveBeenCalled();
  });

  it('should preserve existing request ID from client headers', () => {
    const customId = 'client-provided-custom-id-12345';
    const req = {
      headers: {
        'x-request-id': customId,
      },
    } as unknown as AppRequest;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.id).toBe(customId);
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, customId);
    expect(next).toHaveBeenCalled();
  });
});
