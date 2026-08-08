import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RbacService } from '../../../rbac/application/rbac.service';
import { AuthenticatedUser } from '../../domain/authenticated-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !user.id) {
      throw new ForbiddenException('User identity missing for permission verification.');
    }

    const hasPerm = await this.rbacService.hasPermission(user.id, requiredPermissions);

    if (!hasPerm) {
      throw new ForbiddenException(
        `You do not possess the required permissions (${requiredPermissions.join(', ')}) to access this resource.`,
      );
    }

    return true;
  }
}
