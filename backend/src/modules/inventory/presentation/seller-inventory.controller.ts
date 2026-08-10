import {
  Controller,
  Get,
  Post,
  Patch,
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
import { UpdateInventorySettingsDto } from './dto/update-inventory-settings.dto';
import { SellerInventoryQueryDto } from './dto/seller-inventory-query.dto';
import { InventoryStatus } from '@prisma/client';
import { AppRequest } from '../../../common/types/request-context.interface';

type AuthenticatedRequest = AppRequest & { user: { id: string } };

@ApiTags('Seller / Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sellers/me/inventory')
export class SellerInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List inventory for authenticated seller store' })
  @ApiResponse({ status: 200, description: 'Paginated list of store inventory.' })
  async listMyInventory(
    @Req() req: AuthenticatedRequest,
    @Query() query: SellerInventoryQueryDto,
  ) {
    return this.inventoryService.listSellerInventory(req.user.id, query);
  }

  @Get('low-stock')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List low stock inventory items for seller store' })
  @ApiResponse({ status: 200, description: 'Paginated list of low stock items.' })
  async listLowStock(
    @Req() req: AuthenticatedRequest,
    @Query() query: SellerInventoryQueryDto,
  ) {
    return this.inventoryService.listSellerInventory(req.user.id, {
      ...query,
      status: InventoryStatus.LOW_STOCK,
    });
  }

  @Get('out-of-stock')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List out of stock inventory items for seller store' })
  @ApiResponse({ status: 200, description: 'Paginated list of out of stock items.' })
  async listOutOfStock(
    @Req() req: AuthenticatedRequest,
    @Query() query: SellerInventoryQueryDto,
  ) {
    return this.inventoryService.listSellerInventory(req.user.id, {
      ...query,
      status: InventoryStatus.OUT_OF_STOCK,
    });
  }

  @Get(':variantId')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'Get inventory details for a specific variant' })
  @ApiResponse({ status: 200, description: 'Inventory details.' })
  async getInventoryByVariantId(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ) {
    await this.inventoryService.verifySellerOwnership(req.user.id, variantId);
    return this.inventoryService.getInventoryByVariantId(variantId);
  }

  @Post(':variantId/adjust')
  @HttpCode(HttpStatus.OK)
  @Permissions('inventory.adjust')
  @ApiOperation({ summary: 'Adjust stock quantity for a variant' })
  @ApiResponse({ status: 200, description: 'Inventory stock adjusted successfully.' })
  async adjustStock(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: AdjustInventoryDto,
  ) {
    await this.inventoryService.verifySellerOwnership(req.user.id, variantId);
    return this.inventoryService.adjustStock(
      req.user.id,
      variantId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch(':variantId/settings')
  @Permissions('inventory.manage')
  @ApiOperation({ summary: 'Update inventory settings (e.g. low stock threshold)' })
  @ApiResponse({ status: 200, description: 'Inventory settings updated successfully.' })
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateInventorySettingsDto,
  ) {
    await this.inventoryService.verifySellerOwnership(req.user.id, variantId);
    return this.inventoryService.updateInventorySettings(
      req.user.id,
      variantId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get(':variantId/movements')
  @Permissions('inventory.movements.read')
  @ApiOperation({ summary: 'Get audit movement ledger for a specific variant' })
  @ApiResponse({ status: 200, description: 'Paginated movement log.' })
  async getMovements(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    await this.inventoryService.verifySellerOwnership(req.user.id, variantId);
    const inventory = await this.inventoryService.getInventoryByVariantId(variantId);
    return this.inventoryService.getMovements(inventory.id, page, limit);
  }
}
