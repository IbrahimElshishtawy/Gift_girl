import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({
    example: 'var_uuid_123',
    description: 'Target product variant ID',
  })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({
    example: 2,
    description: 'Quantity of stock to reserve',
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    example: 900,
    description: 'Reservation TTL in seconds (default: 900s / 15 minutes)',
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  ttlSeconds?: number;

  @ApiPropertyOptional({
    example: 'CART',
    description: 'Reference type (e.g. CART, ORDER)',
  })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({
    example: 'cart_session_9921',
    description: 'Reference ID',
  })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({
    example: 'idemp_key_res_001',
    description: 'Idempotency key to prevent double reservation',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
