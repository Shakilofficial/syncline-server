import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/responseMessage.decorator';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const responseMessage = this.reflector.get<string>(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((result) => {
        // Handle case where result is already formatted
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }

        let message = responseMessage || 'Operation successful';
        let data = result;
        let meta: any = undefined;

        // If result contains paginated format: { data, meta, message }
        if (result && typeof result === 'object' && 'data' in result) {
          data = result.data;
          if ('meta' in result) {
            meta = result.meta;
          }
          if ('message' in result) {
            message = result.message;
          }
        }

        return {
          success: true,
          message,
          data,
          ...(meta && { meta }),
        };
      }),
    );
  }
}
