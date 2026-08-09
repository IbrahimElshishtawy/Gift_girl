import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RoleEntity } from '../domain/role.entity';
import { PermissionEntity } from '../domain/permission.entity';

@Injectable()
export class RbacRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRoleByCode(code: string): Promise<RoleEntity | null> {
    const role = await this.prisma.role.findUnique({
      where: { code },
    });
    return role ? RoleEntity.fromPrisma(role) : null;
  }

  async findRoleById(id: string): Promise<RoleEntity | null> {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    return role ? RoleEntity.fromPrisma(role) : null;
  }

  async findAllRoles(): Promise<RoleEntity[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
    });
    return roles.map(RoleEntity.fromPrisma);
  }

  async createRole(data: {
    code: string;
    name: string;
    description?: string;
    isSystem?: boolean;
  }): Promise<RoleEntity> {
    const role = await this.prisma.role.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        isSystem: data.isSystem ?? false,
      },
    });
    return RoleEntity.fromPrisma(role);
  }

  async updateRole(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<RoleEntity> {
    const updated = await this.prisma.role.update({
      where: { id },
      data,
    });
    return RoleEntity.fromPrisma(updated);
  }

  async deleteRole(id: string): Promise<void> {
    await this.prisma.role.delete({
      where: { id },
    });
  }

  async findPermissionsForRole(roleId: string): Promise<PermissionEntity[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rolePermissions.map((rp) => PermissionEntity.fromPrisma(rp.permission));
  }

  async findAllPermissions(): Promise<PermissionEntity[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
    return permissions.map(PermissionEntity.fromPrisma);
  }

  async findPermissionByCode(code: string): Promise<PermissionEntity | null> {
    const perm = await this.prisma.permission.findUnique({
      where: { code },
    });
    return perm ? PermissionEntity.fromPrisma(perm) : null;
  }

  async createPermission(data: {
    code: string;
    name: string;
    description?: string;
    resource: string;
    action: string;
  }): Promise<PermissionEntity> {
    const perm = await this.prisma.permission.create({
      data,
    });
    return PermissionEntity.fromPrisma(perm);
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    });
  }

  async findPermissionsForUser(userId: string): Promise<PermissionEntity[]> {
    // Collect user direct dynamic roles + legacy single User.role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return [];

    const permissionMap = new Map<string, PermissionEntity>();

    // 1. Process roleAssignments
    for (const assignment of user.roleAssignments) {
      for (const rp of assignment.role.rolePermissions) {
        permissionMap.set(rp.permission.code, PermissionEntity.fromPrisma(rp.permission));
      }
    }

    // 2. Process legacy User.role fallback
    const systemRole = await this.prisma.role.findUnique({
      where: { code: user.role },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    if (systemRole) {
      for (const rp of systemRole.rolePermissions) {
        permissionMap.set(rp.permission.code, PermissionEntity.fromPrisma(rp.permission));
      }
    }

    return Array.from(permissionMap.values());
  }

  async findRolesForUser(userId: string): Promise<RoleEntity[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    if (!user) return [];

    const roleMap = new Map<string, RoleEntity>();
    for (const ra of user.roleAssignments) {
      roleMap.set(ra.role.code, RoleEntity.fromPrisma(ra.role));
    }

    const legacyRole = await this.prisma.role.findUnique({
      where: { code: user.role },
    });

    if (legacyRole) {
      roleMap.set(legacyRole.code, RoleEntity.fromPrisma(legacyRole));
    }

    return Array.from(roleMap.values());
  }

  async assignRolesToUser(userId: string, roleIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({
        where: { userId },
      });

      if (roleIds.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: roleIds.map((roleId) => ({
            userId,
            roleId,
          })),
        });
      }
    });
  }
}
