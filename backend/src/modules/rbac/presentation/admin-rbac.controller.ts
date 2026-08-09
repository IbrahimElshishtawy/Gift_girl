import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/domain/authenticated-user.interface';
import { UserRole } from '@prisma/client';
import { RbacService } from '../application/rbac.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AppRequest } from '../../../common/types/request-context.interface';

@ApiTags('Admin Role & Permission Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminRbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'List all system and custom roles' })
  async getRoles() {
    return this.rbacService.getRoles();
  }

  @Get('roles/:id')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Get role details by ID' })
  async getRoleById(@Param('id') roleId: string) {
    return this.rbacService.getRoleById(roleId);
  }

  @Post('roles')
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Create a new custom role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  async createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createCustomRole(dto.code, dto.name, dto.description);
  }

  @Patch('roles/:id')
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Update a custom role name and description' })
  async updateRole(@Param('id') roleId: string, @Body() dto: UpdateRoleDto) {
    return this.rbacService.updateCustomRole(roleId, dto.name, dto.description);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Delete a custom role (Protected system roles are restricted)' })
  async deleteRole(@Param('id') roleId: string) {
    await this.rbacService.deleteCustomRole(roleId);
  }

  @Get('permissions')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'List all available system permissions' })
  async getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Get('roles/:id/permissions')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Get permissions assigned to a role' })
  async getRolePermissions(@Param('id') roleId: string) {
    return this.rbacService.getPermissionsForRole(roleId);
  }

  @Put('roles/:id/permissions')
  @Permissions('permissions.assign')
  @ApiOperation({ summary: 'Assign permissions to a role (Privilege Escalation Protected)' })
  async assignRolePermissions(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') roleId: string,
    @Body() dto: AssignPermissionsDto,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    await this.rbacService.assignPermissionsToRole(adminUser.id, roleId, dto.permissions, ip, ua);

    return { message: 'Role permissions updated successfully.' };
  }
}
