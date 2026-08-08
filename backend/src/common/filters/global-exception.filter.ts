import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppRequest } from '../types/request-context.interface';
import { ApiResponseError, ApiErrorDetail } from '../types/api-response.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AppRequest>();

    const requestId = request?.id || 'N/A';
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'An unexpected internal server error occurred.';
    let errorDetails: ApiErrorDetail[] | string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, unknown>;
        errorMessage = (respObj.message as string) || exception.message;

        if (Array.isArray(respObj.message)) {
          errorDetails = respObj.message as string[];
          errorMessage = 'Validation failed';
        }

        if (respObj.error && typeof respObj.error === 'string') {
          errorCode = respObj.error.toUpperCase().replace(/\s+/g, '_');
        } else {
          errorCode = HttpStatus[status] || 'HTTP_ERROR';
        }
      }
    } else if (exception instanceof Error) {
      // General JavaScript Error (do not expose internal trace or db schema in production)
      this.logger.error(
        `Unhandled Exception [${requestId}]: ${exception.message}`,
        exception.stack,
      );

      if (process.env.NODE_ENV === 'development') {
        errorMessage = exception.message;
      }
    } else {
      this.logger.error(`Unknown exception type caught [${requestId}]:`, exception);
    }

    const payload: ApiResponseError = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        ...(errorDetails ? { details: errorDetails } : {}),
      },
      requestId,
      timestamp,
    };

    response.status(status).json(payload);
  }
}
