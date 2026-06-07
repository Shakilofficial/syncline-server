import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { HttpExceptionFilter } from './common/filters/httpException.filter';
import { JwtAuthGuard } from './common/guards/jwtAuth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestLoggerMiddleware } from './common/middleware/requestLogger.middleware';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { PrismaModule } from './core/prisma/prisma.module';
import { QueueModule } from './core/queue/queue.module';
import { RedisModule } from './core/redis/redis.module';
import { StorageModule } from './core/storage/storage.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UserModule } from './modules/user/user.module';
import { ProjectModule } from './modules/project/project.module';
import { TaskModule } from './modules/task/task.module';
import { CommentModule } from './modules/comment/comment.module';
import { AttachmentModule } from './modules/attachment/attachment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.get<number>('rateLimit.windowMs') || 900000,
          limit: configService.get<number>('rateLimit.max') || 100,
        },
      ],
    }),

    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    ActivityModule,
    AuthModule,
    NotificationModule,
    UserModule,
    ProjectModule,
    TaskModule,
    CommentModule,
    AttachmentModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
