import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/domain/authenticated-user.interface';
import { UserRole, StoreStatus } from '@prisma/client';
import { StoresService } from '../application/stores.service';
import { AdminStoreQueryDto } from './dto/admin-store-query.dto';
import { AdminUpdateStoreStatusDto } from './dto/admin-update-store-status.dto';
import { AppRequest } from '../../../common/types/request-context.interface';

@ApiTags('Admin Store Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/stores')
export class AdminStoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @Permissions('stores.read')
  @ApiOperation({ summary: 'Paginated, searched, and filtered administrative list of stores' })
  async listStores(@Query() query: AdminStoreQueryDto) {
    return this.storesService.listStoresAdmin(query);
  }

  @Get(':id')
  @Permissions('stores.read')
  @ApiOperation({ summary: 'Get complete administrative details for a store' })
  async getStoreById(@Param('id') storeId: string) {
    return this.storesService.getStoreByIdAdmin(storeId);
  }

  @Post(':id/approve')
  @Permissions('stores.approve')
  @ApiOperation({ summary: 'Approve store submission (moves status to ACTIVE)' })
  async approveStore(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') storeId: string,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.storesService.updateStoreStatusAdmin(
      adminUser.id,
      storeId,
      StoreStatus.ACTIVE,
      'Approved by administrator',
      ip,
      ua,
    );
  }

  @Post(':id/suspend')
  @Permissions('stores.suspend')
  @ApiOperation({ summary: 'Suspend store' })
  async suspendStore(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') storeId: string,
    @Body() body: { reason?: string },
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.storesService.updateStoreStatusAdmin(
      adminUser.id,
      storeId,
      StoreStatus.SUSPENDED,
      body?.reason,
      ip,
      ua,
    );
  }

  @Post(':id/activate')
  @Permissions('stores.approve')
  @ApiOperation({ summary: 'Activate suspended store' })
  async activateStore(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') storeId: string,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.storesService.updateStoreStatusAdmin(
      adminUser.id,
      storeId,
      StoreStatus.ACTIVE,
      'Activated by administrator',
      ip,
      ua,
    );
  }
}
