import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/domain/authenticated-user.interface';
import { StoresService } from '../application/stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@ApiTags('Seller Store Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sellers/me/store')
export class SellerStoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'Get store details for authenticated seller' })
  async getMyStore(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.getMyStore(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new storefront for authenticated active seller' })
  @ApiResponse({ status: 201, description: 'Store created in DRAFT status' })
  async createStore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStoreDto,
  ) {
    return this.storesService.createStore(user.id, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Update storefront details' })
  async updateStore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.updateStore(user.id, dto);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit store for administrative review' })
  async submitStoreForReview(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.submitStoreForReview(user.id);
  }
}
