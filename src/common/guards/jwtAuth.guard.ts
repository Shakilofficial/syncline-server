import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        message: 'Authentication token is missing',
        code: 'TOKEN_MISSING',
      });
    }

    try {
      const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync(token, {
        secret: accessSecret,
      });

      const user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          message: 'User no longer exists',
          code: 'TOKEN_INVALID',
        });
      }

      if (!user.isActive) {
        throw new UnauthorizedException({
          message: 'Account has been deactivated',
          code: 'ACCOUNT_INACTIVE',
        });
      }

      request.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      const errorMsg =
        err?.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
      const errorCode =
        err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';

      throw new UnauthorizedException({
        message: errorMsg,
        code: errorCode,
      });
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }
    return authHeader.trim();
  }
}
