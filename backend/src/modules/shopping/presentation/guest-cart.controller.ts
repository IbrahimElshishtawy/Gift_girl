import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GuestCartService } from '../application/guest-cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('Shopping / Guest Cart')
@Controller('guest-cart')
export class GuestCartController {
  constructor(private readonly guestCartService: GuestCartService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new secure guest shopping cart' })
  @ApiResponse({ status: 201, description: 'Guest cart created with secure guestToken.' })
  async createGuestCart() {
    return this.guestCartService.createGuestCart();
  }

  @Get(':token')
  @ApiOperation({ summary: 'Retrieve guest cart by token' })
  @ApiResponse({ status: 200, description: 'Guest cart details.' })
  async getGuestCart(@Param('token') token: string) {
    return this.guestCartService.getGuestCartByToken(token);
  }

  @Post(':token/items')
  @ApiOperation({ summary: 'Add product variant item to guest cart' })
  @ApiResponse({ status: 201, description: 'Item added to guest cart.' })
  async addItem(@Param('token') token: string, @Body() dto: AddToCartDto) {
    return this.guestCartService.addItemToGuestCart(token, dto);
  }

  @Patch(':token/items/:itemId')
  @ApiOperation({ summary: 'Update item quantity in guest cart' })
  @ApiResponse({ status: 200, description: 'Guest cart item quantity updated.' })
  async updateItemQuantity(
    @Param('token') token: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.guestCartService.updateGuestCartItemQuantity(token, itemId, dto);
  }

  @Delete(':token/items/:itemId')
  @ApiOperation({ summary: 'Remove item from guest cart' })
  @ApiResponse({ status: 200, description: 'Item removed from guest cart.' })
  async removeItem(@Param('token') token: string, @Param('itemId') itemId: string) {
    return this.guestCartService.removeGuestCartItem(token, itemId);
  }

  @Delete(':token')
  @ApiOperation({ summary: 'Clear all items from guest cart' })
  @ApiResponse({ status: 200, description: 'Guest cart cleared.' })
  async clearCart(@Param('token') token: string) {
    return this.guestCartService.clearGuestCart(token);
  }
}
