import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 3,
  PROJECT_MANAGER: 2,
  TEAM_MEMBER: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const userRoleLevel = ROLE_HIERARCHY[user.role as Role] || 0;
    const maxRequiredLevel = Math.max(
      ...requiredRoles.map((role) => ROLE_HIERARCHY[role]),
    );

    if (userRoleLevel < maxRequiredLevel) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this action',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    return true;
  }
}
