import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { WishlistService } from '../application/wishlist.service';
import { AddToWishlistDto } from './dto/add-to-wishlist.dto';
import { AppRequest } from '../../../common/types/request-context.interface';

type AuthenticatedRequest = AppRequest & { user: { id: string } };

@ApiTags('Shopping / Wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users/me/wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @Permissions('wishlist.read')
  @ApiOperation({ summary: 'Get authenticated user wishlist' })
  @ApiResponse({ status: 200, description: 'User wishlist items.' })
  async getMyWishlist(@Req() req: AuthenticatedRequest) {
    return this.wishlistService.getUserWishlist(req.user.id);
  }

  @Post('items')
  @Permissions('wishlist.manage')
  @ApiOperation({ summary: 'Add product variant item to wishlist' })
  @ApiResponse({ status: 201, description: 'Item added to wishlist.' })
  async addItem(@Req() req: AuthenticatedRequest, @Body() dto: AddToWishlistDto) {
    return this.wishlistService.addItemToWishlist(
      req.user.id,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('items/:variantId')
  @Permissions('wishlist.manage')
  @ApiOperation({ summary: 'Remove variant item from wishlist' })
  @ApiResponse({ status: 200, description: 'Item removed from wishlist.' })
  async removeItem(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ) {
    return this.wishlistService.removeItemFromWishlist(
      req.user.id,
      variantId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('items/:variantId/move-to-cart')
  @HttpCode(HttpStatus.OK)
  @Permissions('wishlist.manage', 'cart.manage')
  @ApiOperation({ summary: 'Move wishlist item to cart' })
  @ApiResponse({ status: 200, description: 'Item moved from wishlist to cart.' })
  async moveToCart(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ) {
    return this.wishlistService.moveWishlistItemToCart(
      req.user.id,
      variantId,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
