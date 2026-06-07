import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { CreateUserDto } from './dto/createUser.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenService: TokenService,
  ) {}

  // ── Signup ───────────────────────────────────────────────────────────────────
  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException({
        message: 'An account with this email already exists',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    const saltRounds = this.configService.get<number>('bcryptSaltRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    const tokens = await this.tokenService.generateAndStoreTokens(
      user.id,
      user.email,
      user.role,
    );

    return { user, tokens };
  }

  // ── Admin: Create User (any role) ─────────────────────────────────────────
  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException({
        message: 'An account with this email already exists',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    const saltRounds = this.configService.get<number>('bcryptSaltRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role ?? undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'No account found with this email address.',
        code: 'EMAIL_NOT_FOUND',
      });
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException({
        message: 'Incorrect Password',
        code: 'INCORRECT_PASSWORD',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        message:
          'Your account has been deactivated. Please contact an administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    const tokens = await this.tokenService.generateAndStoreTokens(
      user.id,
      user.email,
      user.role,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  // ── Refresh Tokens ───────────────────────────────────────────────────────────
  async refreshTokens(refreshToken: string) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET');
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException({
          message: 'Invalid token type',
          code: 'TOKEN_INVALID',
        });
      }

      // Check token in Redis for active rotation check
      const storedToken = await this.redis.get(`refresh_token:${payload.jti}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException({
          message: 'Refresh token is invalid or has been revoked',
          code: 'REFRESH_TOKEN_INVALID',
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException({
          message: 'Account not found or deactivated',
          code: 'TOKEN_INVALID',
        });
      }

      // Invalidate old token in Redis (one-time use rotation)
      await this.redis.del(`refresh_token:${payload.jti}`);

      // Mark as revoked in DB
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      });

      // Generate new token pair
      return this.tokenService.generateAndStoreTokens(
        user.id,
        user.email,
        user.role,
      );
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET');
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });

      // Revoke in Redis
      await this.redis.del(`refresh_token:${payload.jti}`);

      // Revoke in DB
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      });
    } catch {
      // Silently swallow errors during logout so client session cleanup proceeds
    }
  }

  // ── Get Current Profile ──────────────────────────────────────────────────────
  async getMe(userId: string) {
    const cacheKey = `user:${userId}`;
    const cached = await this.redis.getJson<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const cacheTtl = this.configService.get<number>('userCacheTtl') || 300;
    await this.redis.setJson(cacheKey, user, cacheTtl);

    return user;
  }

  // ── Change Password ──────────────────────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!match) {
      throw new BadRequestException({
        message: 'Incorrect current password',
        code: 'INCORRECT_CURRENT_PASSWORD',
      });
    }

    const isSame = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSame) {
      throw new BadRequestException({
        message: 'New password cannot be the same as the current password',
        code: 'SAME_PASSWORD',
      });
    }

    const saltRounds = this.configService.get<number>('bcryptSaltRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Clear Cache
    await this.redis.del(`user:${userId}`);

    // Revoke all refresh tokens for this user
    await this.revokeUserTokens(userId);

    return { success: true };
  }

  // Helper to revoke all user sessions/tokens
  private async revokeUserTokens(userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false },
      select: { token: true },
    });

    for (const record of tokens) {
      try {
        const decoded = this.jwtService.decode(record.token);
        if (decoded?.jti) {
          await this.redis.del(`refresh_token:${decoded.jti}`);
        }
      } catch {}
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
