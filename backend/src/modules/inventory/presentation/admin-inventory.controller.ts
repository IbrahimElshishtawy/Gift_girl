import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { InventoryService } from '../application/inventory.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { AdminInventoryQueryDto } from './dto/admin-inventory-query.dto';
import { InventoryStatus } from '@prisma/client';
import { AppRequest } from '../../../common/types/request-context.interface';

type AuthenticatedRequest = AppRequest & { user: { id: string } };

@ApiTags('Admin / Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List platform inventory (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list of platform inventory.' })
  async listAdminInventory(@Query() query: AdminInventoryQueryDto) {
    return this.inventoryService.listAdminInventory(query);
  }

  @Get('low-stock')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List low stock inventory items across platform (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list of low stock items.' })
  async listLowStock(@Query() query: AdminInventoryQueryDto) {
    return this.inventoryService.listAdminInventory({
      ...query,
      status: InventoryStatus.LOW_STOCK,
    });
  }

  @Get('out-of-stock')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List out of stock inventory items across platform (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list of out of stock items.' })
  async listOutOfStock(@Query() query: AdminInventoryQueryDto) {
    return this.inventoryService.listAdminInventory({
      ...query,
      status: InventoryStatus.OUT_OF_STOCK,
    });
  }

  @Get(':variantId')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'Get inventory details for a specific variant (Admin)' })
  @ApiResponse({ status: 200, description: 'Inventory details.' })
  async getInventoryByVariantId(@Param('variantId') variantId: string) {
    return this.inventoryService.getInventoryByVariantId(variantId);
  }

  @Post(':variantId/adjust')
  @HttpCode(HttpStatus.OK)
  @Permissions('inventory.adjust')
  @ApiOperation({ summary: 'Adjust stock quantity for a variant (Admin Override)' })
  @ApiResponse({ status: 200, description: 'Inventory stock adjusted successfully.' })
  async adjustStock(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: AdjustInventoryDto,
  ) {
    return this.inventoryService.adjustStock(
      req.user.id,
      variantId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get(':variantId/movements')
  @Permissions('inventory.movements.read')
  @ApiOperation({ summary: 'Get audit movement ledger for a specific variant (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated movement log.' })
  async getMovements(
    @Param('variantId') variantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const inventory = await this.inventoryService.getInventoryByVariantId(variantId);
    return this.inventoryService.getMovements(inventory.id, page, limit);
  }
}
