import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Injectable()
export class TokenService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ── Token generation and session persistence ───────────────────────
  async generateAndStoreTokens(userId: string, email: string, role: string) {
    const jti = uuidv4();

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, role, type: 'access' },
      { secret: accessSecret, expiresIn: accessExpiresIn as any },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti, type: 'refresh' },
      { secret: refreshSecret, expiresIn: refreshExpiresIn as any },
    );

    // Calculate refresh token expiry time
    const expiresAt = this.getRefreshTokenExpiryDate(refreshExpiresIn);

    // Persist in Redis with expiry matching token duration
    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    await this.redis.set(`refresh_token:${jti}`, refreshToken, ttlSeconds);

    // Persist in DB
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  getCookieOptions() {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = this.getRefreshTokenExpiryDate(refreshExpiresIn);
    const maxAge = expiresAt.getTime() - Date.now();

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      maxAge,
    };
  }

  getRefreshTokenExpiryDate(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      // Default to 7 days
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2];
    const ms =
      unit === 's'
        ? amount * 1000
        : unit === 'm'
          ? amount * 60 * 1000
          : unit === 'h'
            ? amount * 60 * 60 * 1000
            : amount * 24 * 60 * 60 * 1000; // 'd'

    return new Date(Date.now() + ms);
  }
}
