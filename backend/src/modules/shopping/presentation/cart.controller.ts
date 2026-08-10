import {
  Controller,
  Get,
  Post,
  Patch,
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
import { CartService } from '../application/cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { AppRequest } from '../../../common/types/request-context.interface';

type AuthenticatedRequest = AppRequest & { user: { id: string } };

@ApiTags('Shopping / Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Permissions('cart.read')
  @ApiOperation({ summary: 'Get active shopping cart for authenticated user' })
  @ApiResponse({ status: 200, description: 'Active shopping cart details.' })
  async getMyCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  @Permissions('cart.manage')
  @ApiOperation({ summary: 'Add product variant item to cart' })
  @ApiResponse({ status: 201, description: 'Item added to cart successfully.' })
  async addItem(@Req() req: AuthenticatedRequest, @Body() dto: AddToCartDto) {
    return this.cartService.addItemToCart(
      req.user.id,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('items/:itemId')
  @Permissions('cart.manage')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Cart item quantity updated.' })
  async updateItemQuantity(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItemQuantity(req.user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  @Permissions('cart.manage')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 200, description: 'Cart item removed.' })
  async removeItem(@Req() req: AuthenticatedRequest, @Param('itemId') itemId: string) {
    return this.cartService.removeCartItem(req.user.id, itemId);
  }

  @Delete()
  @Permissions('cart.manage')
  @ApiOperation({ summary: 'Clear all items from active cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared successfully.' })
  async clearCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.clearCart(req.user.id, req.ip, req.headers['user-agent']);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Permissions('cart.read')
  @ApiOperation({ summary: 'Validate active cart items against current catalog & inventory state' })
  @ApiResponse({ status: 200, description: 'Cart validation report.' })
  async validateCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.validateCart(req.user.id);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @Permissions('cart.manage')
  @ApiOperation({ summary: 'Merge guest cart into authenticated user cart' })
  @ApiResponse({ status: 200, description: 'Guest cart merged into user cart.' })
  async mergeGuestCart(@Req() req: AuthenticatedRequest, @Body() dto: MergeCartDto) {
    return this.cartService.mergeGuestCart(
      req.user.id,
      dto.guestToken,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
