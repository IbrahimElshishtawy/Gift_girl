import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { ProductsSellerService } from '../application/products-seller.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { AddMediaDto } from './dto/add-media.dto';
import { AdminProductQueryDto } from './dto/admin-product-query.dto';
import { AppRequest } from '../../../common/types/request-context.interface';

type AuthenticatedRequest = AppRequest & { user: { id: string } };

@ApiTags('Seller / Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sellers/me/products')
export class SellerProductsController {
  constructor(private readonly sellerProductsService: ProductsSellerService) {}

  @Get()
  @Permissions('products.read')
  @ApiOperation({ summary: 'Paginated list of products for authenticated seller store' })
  @ApiResponse({ status: 200, description: 'Paginated product list.' })
  async listMyProducts(@Req() req: AuthenticatedRequest, @Query() query: AdminProductQueryDto) {
    return this.sellerProductsService.listSellerProducts(req.user.id, query);
  }

  @Get(':id')
  @Permissions('products.read')
  @ApiOperation({ summary: 'Get product details for authenticated seller store' })
  @ApiResponse({ status: 200, description: 'Product details.' })
  async getMyProductById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sellerProductsService.getSellerProductById(req.user.id, id);
  }

  @Post()
  @Permissions('products.create')
  @ApiOperation({ summary: 'Create new product in DRAFT status' })
  @ApiResponse({ status: 201, description: 'Product created successfully.' })
  async createProduct(@Req() req: AuthenticatedRequest, @Body() dto: CreateProductDto) {
    return this.sellerProductsService.createProduct(req.user.id, dto);
  }

  @Patch(':id')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Update product details' })
  @ApiResponse({ status: 200, description: 'Product updated successfully.' })
  async updateProduct(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.sellerProductsService.updateProduct(req.user.id, id, dto);
  }

  @Post(':id/submit')
  @Permissions('products.submit')
  @ApiOperation({ summary: 'Submit product for admin review (PENDING_REVIEW)' })
  @ApiResponse({ status: 200, description: 'Product submitted for review.' })
  async submitProduct(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sellerProductsService.submitProductForReview(req.user.id, id);
  }

  @Post(':id/archive')
  @Permissions('products.archive')
  @ApiOperation({ summary: 'Archive product' })
  @ApiResponse({ status: 200, description: 'Product archived.' })
  async archiveProduct(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sellerProductsService.archiveProduct(req.user.id, id);
  }

  @Post(':id/options')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Create product option dimension and values (e.g. Color, Size)' })
  @ApiResponse({ status: 201, description: 'Option created.' })
  async createOption(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateOptionDto,
  ) {
    return this.sellerProductsService.createOption(req.user.id, id, dto);
  }

  @Post(':id/variants')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Create product variant with unique SKU and option values' })
  @ApiResponse({ status: 201, description: 'Variant created.' })
  async addVariant(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.sellerProductsService.addVariant(req.user.id, id, dto);
  }

  @Post(':id/media')
  @Permissions('product_media.manage')
  @ApiOperation({ summary: 'Add product media metadata reference' })
  @ApiResponse({ status: 201, description: 'Media added.' })
  async addMedia(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AddMediaDto,
  ) {
    return this.sellerProductsService.addMedia(req.user.id, id, dto);
  }

  @Delete(':id/media/:mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('product_media.manage')
  @ApiOperation({ summary: 'Delete product media metadata reference' })
  @ApiResponse({ status: 204, description: 'Media deleted.' })
  async deleteMedia(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    await this.sellerProductsService.deleteMedia(req.user.id, id, mediaId);
  }
}
