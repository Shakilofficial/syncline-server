import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 8000;

  @IsString()
  CLIENT_URL: string = 'http://localhost:8001';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsNumber()
  @IsOptional()
  BCRYPT_SALT_ROUNDS: number = 12;

  @IsNumber()
  @IsOptional()
  USER_CACHE_TTL: number = 300;

  @IsString()
  @IsOptional()
  AWS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  AWS_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  AWS_REGION: string = 'us-east-1';

  @IsString()
  @IsOptional()
  AWS_S3_BUCKET?: string;

  @IsString()
  @IsOptional()
  AWS_ENDPOINT_URL?: string;

  @IsNumber()
  @IsOptional()
  MAX_FILE_SIZE_MB: number = 10;

  @IsString()
  @IsOptional()
  ALLOWED_MIME_TYPES: string =
    'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain';

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_WINDOW_MS: number = 900000;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX: number = 100;

  @IsNumber()
  @IsOptional()
  AUTH_RATE_LIMIT_MAX: number = 5;

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
