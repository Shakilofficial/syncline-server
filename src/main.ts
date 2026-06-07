import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import * as fs from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Programmatically ensure local upload directory exists
  fs.mkdirSync('./public/uploads/avatars', { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
  });

  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 8000;
  const clientUrl =
    configService.get<string>('CLIENT_URL') || 'http://localhost:3000';

  // Enforce CORS whitelist matching client configuration
  app.enableCors({
    origin: [clientUrl],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With',
  });

  // Global prefix for clean API version routing
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // Enforce strict type validation on DTO entries
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(port);
  logger.log(`🚀 Syncline NestJS Server listening on port ${port}`);
  logger.log(`👉 Client URL allowed: ${clientUrl}`);
}
bootstrap().catch((err) => {
  const logger = new Logger('BootstrapError');
  logger.error('Failed to start server:', err);
  process.exit(1);
});
