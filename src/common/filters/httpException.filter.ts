import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errors: any[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent: any = exception.getResponse();

      if (typeof resContent === 'object' && resContent !== null) {
        message = resContent.message || exception.message;
        errors = resContent.errors || undefined;

        if (Array.isArray(resContent.message)) {
          message = 'Validation failed';
          errors = resContent.message.map((msg: string) => {
            const split = msg.split(' ');
            const field = split[0] || 'field';
            return {
              field,
              message: msg,
            };
          });
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Exception at [${request.method} ${request.url}]: ${exception.message}`,
        exception.stack,
      );

      if (
        exception.message.includes('unique constraint') ||
        exception.message.includes('already exists') ||
        (exception as any).code === 'P2002'
      ) {
        status = HttpStatus.CONFLICT;
        message = 'A record with this unique value already exists';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'An unexpected error occurred';
      }
    } else {
      this.logger.error(
        `Unknown error thrown at [${request.method} ${request.url}]: ${JSON.stringify(exception)}`,
      );
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
    }

    response.status(status).json({
      success: false,
      message,
      ...(errors && { errors }),
    });
  }
}
