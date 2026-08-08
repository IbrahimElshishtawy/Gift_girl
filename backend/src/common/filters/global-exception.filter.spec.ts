import { GlobalExceptionFilter } from './global-exception.filter';
import { BadRequestException, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { AppRequest } from '../types/request-context.interface';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('should format HttpException properly', () => {
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const mockRequest = {
      id: 'test-request-id-123',
    } as AppRequest;

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    const exception = new BadRequestException('Invalid payload provided');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'Invalid payload provided',
        }),
        requestId: 'test-request-id-123',
      }),
    );
  });
});
