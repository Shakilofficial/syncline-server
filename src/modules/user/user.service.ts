import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { StorageService } from '../../core/storage/storage.service';
import { QueryDto } from '../../common/dto/query.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UpdateUserRoleDto } from './dto/updateRole.dto';
import { UpdateUserStatusDto } from './dto/updateStatus.dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
    private jwtService: JwtService,
    private storageService: StorageService,
  ) {}

  // ── Retrieve Users (Paginated & Filtered) ───────────────────────────────────
  async getUsers(query: QueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);
    const where: any = {};

    if (query.searchTerm) {
      where.OR = [
        { name: { contains: query.searchTerm, mode: 'insensitive' } },
        { email: { contains: query.searchTerm, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      const upperRole = query.role.toUpperCase();
      if (Object.values(Role).includes(upperRole as Role)) {
        where.role = upperRole as Role;
      } else {
        throw new BadRequestException({
          message: `Invalid role filter: ${query.role}`,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    if (query.status) {
      where.isActive = query.status === 'active';
    }
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return PaginationUtil.createResult(data, total, page, limit);
  }

  async getUserById(id: string) {
    const cacheKey = `user:${id}`;
    const cached = await this.redis.getJson<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
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

  async updateUser(id: string, dto: UpdateUserDto, file?: Express.Multer.File) {
    const user = await this.getUserById(id);

    let avatarUrl = user.avatarUrl;
    if (file) {
      const uploadResult = await this.storageService.uploadFile(
        file,
        'avatars',
      );
      avatarUrl = uploadResult.url;

      if (user.avatarUrl) {
        const match = user.avatarUrl.match(/avatars\/[^/]+$/);
        if (match) {
          const oldKey = match[0];
          try {
            await this.storageService.deleteFile(oldKey);
          } catch {}
        }
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        avatarUrl,
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

    await this.redis.del(`user:${id}`);

    return updated;
  }

  async updateUserRole(id: string, dto: UpdateUserRoleDto) {
    await this.getUserById(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
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

    await this.redis.del(`user:${id}`);

    return updated;
  }

  async updateUserStatus(id: string, dto: UpdateUserStatusDto) {
    await this.getUserById(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
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

    await this.redis.del(`user:${id}`);

    if (!dto.isActive) {
      await this.revokeUserTokens(id);
    }

    return updated;
  }

  private async revokeUserTokens(userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false },
      select: { token: true },
    });

    for (const record of tokens) {
      try {
        const decoded: any = this.jwtService.decode(record.token);
        if (decoded && decoded.jti) {
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
