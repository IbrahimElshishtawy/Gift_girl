import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddToWishlistDto {
  @ApiProperty({
    example: 'var_uuid_123',
    description: 'Target product variant ID to save to wishlist',
  })
  @IsString()
  @IsNotEmpty()
  variantId!: string;
}
