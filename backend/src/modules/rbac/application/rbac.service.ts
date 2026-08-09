import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { RoleEntity } from '../domain/role.entity';
import { PermissionEntity } from '../domain/permission.entity';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { SecurityEventType, UserRole } from '@prisma/client';

@Injectable()
export class RbacService {
  constructor(
    private readonly rbacRepository: RbacRepository,
    private readonly prisma: PrismaService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const permissions = await this.rbacRepository.findPermissionsForUser(userId);
    return permissions.map((p) => p.code);
  }

  async hasPermission(userId: string, requiredPermissions: string[]): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    const userPerms = await this.getUserPermissions(userId);
    return requiredPermissions.every((req) => userPerms.includes(req));
  }

  async getRoles(): Promise<RoleEntity[]> {
    return this.rbacRepository.findAllRoles();
  }

  async getRoleById(roleId: string): Promise<RoleEntity> {
    const role = await this.rbacRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    return role;
  }

  async getPermissions(): Promise<PermissionEntity[]> {
    return this.rbacRepository.findAllPermissions();
  }

  async getPermissionsForRole(roleId: string): Promise<PermissionEntity[]> {
    const role = await this.rbacRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    return this.rbacRepository.findPermissionsForRole(roleId);
  }

  async createCustomRole(code: string, name: string, description?: string): Promise<RoleEntity> {
    const normalizedCode = code.toUpperCase();
    const existing = await this.rbacRepository.findRoleByCode(normalizedCode);
    if (existing) {
      throw new ConflictException(`Role with code '${normalizedCode}' already exists.`);
    }

    return this.rbacRepository.createRole({
      code: normalizedCode,
      name,
      description,
      isSystem: false,
    });
  }

  async updateCustomRole(roleId: string, name?: string, description?: string): Promise<RoleEntity> {
    const role = await this.rbacRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    if (role.isSystem) {
      throw new ForbiddenException('Protected system roles cannot be modified.');
    }
    return this.rbacRepository.updateRole(roleId, { name, description });
  }

  async deleteCustomRole(roleId: string): Promise<void> {
    const role = await this.rbacRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    if (role.isSystem) {
      throw new ForbiddenException('Protected system roles cannot be deleted.');
    }
    await this.rbacRepository.deleteRole(roleId);
  }

  async assignRolesToUser(
    performerUserId: string,
    targetUserId: string,
    roleCodes: string[],
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const performer = await this.prisma.user.findUnique({ where: { id: performerUserId } });
    if (!performer) throw new ForbiddenException('Performer user not found.');

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('Target user not found.');

    // Privilege Escalation Protection:
    // Only SUPER_ADMIN can grant SUPER_ADMIN role.
    const isGrantingSuperAdmin = roleCodes.includes(UserRole.SUPER_ADMIN);
    if (isGrantingSuperAdmin && performer.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Privilege escalation denied: Only a Super Administrator can assign the SUPER_ADMIN role.',
      );
    }

    // Resolve Role IDs
    const roleIds: string[] = [];
    let primaryEnumRole: UserRole = UserRole.CUSTOMER;

    for (const code of roleCodes) {
      const role = await this.rbacRepository.findRoleByCode(code);
      if (!role) {
        throw new NotFoundException(`Role with code '${code}' not found.`);
      }
      roleIds.push(role.id);

      if (Object.values(UserRole).includes(code as UserRole)) {
        primaryEnumRole = code as UserRole;
      }
    }

    // Synchronize UserRoleAssignment AND primary User.role for backward compatibility
    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { userId: targetUserId } });
      if (roleIds.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: roleIds.map((roleId) => ({ userId: targetUserId, roleId })),
        });
      }
      await tx.user.update({
        where: { id: targetUserId },
        data: { role: primaryEnumRole },
      });
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.ROLE_ASSIGNED,
      performerUserId,
      ipAddress,
      userAgent,
      { targetUserId, assignedRoles: roleCodes },
    );
  }

  async assignPermissionsToRole(
    performerUserId: string,
    roleId: string,
    permissionCodes: string[],
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const role = await this.rbacRepository.findRoleById(roleId);
    if (!role) throw new NotFoundException('Role not found.');

    const performer = await this.prisma.user.findUnique({ where: { id: performerUserId } });
    if (!performer) throw new ForbiddenException('Performer identity not found.');

    // Protect Super Admin permissions
    if (performer.role !== UserRole.SUPER_ADMIN) {
      const performerPermissions = await this.getUserPermissions(performerUserId);
      const invalidGrants = permissionCodes.filter((code) => !performerPermissions.includes(code));

      if (invalidGrants.length > 0) {
        throw new ForbiddenException(
          `Privilege escalation denied: You cannot grant permissions you do not possess (${invalidGrants.join(', ')}).`,
        );
      }
    }

    const permissionIds: string[] = [];
    for (const code of permissionCodes) {
      const perm = await this.rbacRepository.findPermissionByCode(code);
      if (!perm) throw new NotFoundException(`Permission with code '${code}' not found.`);
      permissionIds.push(perm.id);
    }

    await this.rbacRepository.assignPermissionsToRole(roleId, permissionIds);

    await this.securityAuditService.logEvent(
      SecurityEventType.PERMISSION_ASSIGNED,
      performerUserId,
      ipAddress,
      userAgent,
      { roleId, roleCode: role.code, permissions: permissionCodes },
    );
  }
}
