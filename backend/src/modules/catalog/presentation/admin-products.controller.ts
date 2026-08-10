import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { ProductsAdminService } from '../application/products-admin.service';
import { AdminProductQueryDto } from './dto/admin-product-query.dto';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { AppRequest } from '../../../common/types/request-context.interface';

type AuthenticatedRequest = AppRequest & { user: { id: string } };

export class RejectProductDto {
  @ApiProperty({
    example: 'Violates content policy: prohibited items',
    description: 'Rejection reason',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ApproveProductDto {
  @ApiPropertyOptional({ example: true, description: 'Publish product immediately upon approval' })
  @IsOptional()
  publishImmediately?: boolean = true;
}

@ApiTags('Admin / Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsAdminService: ProductsAdminService) {}

  @Get()
  @Permissions('products.read')
  @ApiOperation({ summary: 'Paginated admin list of products' })
  @ApiResponse({ status: 200, description: 'Paginated list of products.' })
  async listProducts(@Query() query: AdminProductQueryDto) {
    return this.productsAdminService.listProductsAdmin(query);
  }

  @Get(':id')
  @Permissions('products.read')
  @ApiOperation({ summary: 'Get product details by ID' })
  @ApiResponse({ status: 200, description: 'Product details.' })
  async getProductById(@Param('id') id: string) {
    return this.productsAdminService.getProductByIdAdmin(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions('products.approve')
  @ApiOperation({ summary: 'Approve product for publication' })
  @ApiResponse({ status: 200, description: 'Product approved.' })
  async approveProduct(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ApproveProductDto,
  ) {
    return this.productsAdminService.approveProductAdmin(
      req.user.id,
      id,
      dto.publishImmediately ?? true,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Permissions('products.reject')
  @ApiOperation({ summary: 'Reject product application' })
  @ApiResponse({ status: 200, description: 'Product rejected.' })
  async rejectProduct(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
  ) {
    return this.productsAdminService.rejectProductAdmin(
      req.user.id,
      id,
      dto.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Permissions('products.archive')
  @ApiOperation({ summary: 'Archive product' })
  @ApiResponse({ status: 200, description: 'Product archived.' })
  async archiveProduct(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.productsAdminService.archiveProductAdmin(
      req.user.id,
      id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
