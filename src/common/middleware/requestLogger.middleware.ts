import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    const xForwardedFor = request.headers['x-forwarded-for'];
    const ip =
      typeof xForwardedFor === 'string'
        ? xForwardedFor.split(',')[0].trim()
        : request.socket.remoteAddress || request.ip || 'unknown';

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || 0;
      const duration = Date.now() - startTime;

      let statusColor = '\x1b[32m';
      if (statusCode >= 300 && statusCode < 400) {
        statusColor = '\x1b[36m';
      } else if (statusCode >= 400 && statusCode < 500) {
        statusColor = '\x1b[33m';
      } else if (statusCode >= 500) {
        statusColor = '\x1b[31m';
      }

      let methodColor = '\x1b[36m';
      if (method === 'POST') methodColor = '\x1b[32m';
      if (method === 'PUT' || method === 'PATCH') methodColor = '\x1b[35m';
      if (method === 'DELETE') methodColor = '\x1b[31m';

      const resetColor = '\x1b[0m';

      const userId = (request as any).user?.id
        ? ` - User: ${(request as any).user.id}`
        : '';

      this.logger.log(
        `${methodColor}${method}${resetColor} ${originalUrl} ${statusColor}${statusCode}${resetColor} - ${contentLength} bytes - ${duration}ms - IP: ${ip}${userId} - UA: ${userAgent}`,
      );
    });

    next();
  }
}
