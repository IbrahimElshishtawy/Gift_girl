import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { BrandsService } from '../application/brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { AdminBrandQueryDto } from './dto/admin-brand-query.dto';

import { AppRequest } from '../../../common/types/request-context.interface';

type AuthenticatedRequest = AppRequest & { user: { id: string } };

@ApiTags('Admin / Brands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @Permissions('brands.read')
  @ApiOperation({ summary: 'Paginated admin list of brands' })
  @ApiResponse({ status: 200, description: 'Paginated list of brands.' })
  async listBrands(@Query() query: AdminBrandQueryDto) {
    return this.brandsService.listBrandsAdmin(query);
  }

  @Get(':id')
  @Permissions('brands.read')
  @ApiOperation({ summary: 'Get brand details by ID' })
  @ApiResponse({ status: 200, description: 'Brand details.' })
  async getBrandById(@Param('id') id: string) {
    return this.brandsService.getBrandById(id);
  }

  @Post()
  @Permissions('brands.manage')
  @ApiOperation({ summary: 'Create new brand' })
  @ApiResponse({ status: 201, description: 'Brand created successfully.' })
  async createBrand(@Req() req: AuthenticatedRequest, @Body() dto: CreateBrandDto) {
    return this.brandsService.createBrandAdmin(req.user.id, dto, req.ip, req.headers['user-agent']);
  }

  @Patch(':id')
  @Permissions('brands.manage')
  @ApiOperation({ summary: 'Update brand details' })
  @ApiResponse({ status: 200, description: 'Brand updated successfully.' })
  async updateBrand(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.brandsService.updateBrandAdmin(
      req.user.id,
      id,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
