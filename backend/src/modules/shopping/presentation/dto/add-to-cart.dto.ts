import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({
    example: 'var_uuid_123',
    description: 'Target product variant ID to add to cart',
  })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({
    example: 1,
    description: 'Quantity requested (1 to 100)',
  })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}
