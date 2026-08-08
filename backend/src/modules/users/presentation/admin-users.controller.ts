import {
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/domain/authenticated-user.interface';
import { UserRole, UserStatus, SecurityEventType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { RbacService } from '../../rbac/application/rbac.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';
import { AdminAssignRolesDto } from './dto/admin-assign-roles.dto';
import { AppRequest } from '../../../common/types/request-context.interface';

@ApiTags('Admin User Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  @Get()
  @Permissions('users.read')
  @ApiOperation({ summary: 'Paginated, searched, and filtered administrative list of platform users' })
  @ApiResponse({ status: 200, description: 'User list returned successfully' })
  async listUsers(@Query() query: AdminUserQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.emailVerified !== undefined) {
      where.emailVerified = query.emailVerified;
    }

    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          emailVerified: true,
          phoneVerified: true,
          failedLoginAttempts: true,
          lockoutUntil: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  @Get(':id')
  @Permissions('users.read')
  @ApiOperation({ summary: 'Get complete administrative details for a user' })
  async getUserById(@Param('id') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        failedLoginAttempts: true,
        lockoutUntil: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        preference: true,
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
        roleAssignments: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  @Patch(':id/status')
  @Permissions('users.suspend')
  @ApiOperation({ summary: 'Update user account status (ACTIVE, SUSPENDED, DISABLED)' })
  async updateUserStatus(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') targetUserId: string,
    @Body() dto: AdminUpdateUserStatusDto,
    @Req() req: AppRequest,
  ) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw new NotFoundException('User not found.');

    // Protect Super Admin from non-Super Admin suspension/disable
    if (targetUser.role === UserRole.SUPER_ADMIN && adminUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a Super Administrator can change the status of another Super Administrator.');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: dto.status,
      },
    });

    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    await this.securityAuditService.logEvent(
      SecurityEventType.ACCOUNT_STATUS_CHANGE,
      adminUser.id,
      ip,
      ua,
      { targetUserId, previousStatus: targetUser.status, newStatus: dto.status, reason: dto.reason },
    );

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  @Put(':id/roles')
  @Permissions('users.assign_role')
  @ApiOperation({ summary: 'Assign roles to a user (Privilege Escalation Protected)' })
  async assignUserRoles(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') targetUserId: string,
    @Body() dto: AdminAssignRolesDto,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    await this.rbacService.assignRolesToUser(adminUser.id, targetUserId, dto.roles, ip, ua);

    const updatedUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        role: true,
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    return updatedUser;
  }
}
