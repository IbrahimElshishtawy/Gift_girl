import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductsPublicService } from '../application/products-public.service';
import { PublicProductQueryDto } from './dto/public-product-query.dto';

@ApiTags('Public / Products')
@Controller('products')
export class PublicProductsController {
  constructor(private readonly productsPublicService: ProductsPublicService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated public product search & storefront listing' })
  @ApiResponse({ status: 200, description: 'Paginated list of active public products.' })
  async listPublicProducts(@Query() query: PublicProductQueryDto) {
    return this.productsPublicService.listPublicProducts(query);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get active public product details by slug' })
  @ApiResponse({ status: 200, description: 'Active product details.' })
  async getPublicProductBySlug(@Param('slug') slug: string) {
    return this.productsPublicService.getPublicProductBySlug(slug);
  }
}
