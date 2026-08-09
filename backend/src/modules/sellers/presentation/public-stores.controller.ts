import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StoresService } from '../application/stores.service';

@ApiTags('Public Storefront')
@Controller('stores')
export class PublicStoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Get public-safe active store profile by unique slug' })
  @ApiResponse({ status: 200, description: 'Active store profile returned' })
  @ApiResponse({ status: 404, description: 'Store not found or not currently active' })
  async getPublicStoreBySlug(@Param('slug') slug: string) {
    return this.storesService.getPublicStoreBySlug(slug);
  }
}
