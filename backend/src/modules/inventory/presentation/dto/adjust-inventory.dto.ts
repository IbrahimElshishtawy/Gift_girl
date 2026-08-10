import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { InventoryMovementType } from '@prisma/client';

export class AdjustInventoryDto {
  @ApiProperty({
    example: 50,
    description: 'Stock quantity delta (positive to increase, negative to decrease)',
  })
  @IsInt()
  @IsNotEmpty()
  quantityDelta!: number;

  @ApiPropertyOptional({
    enum: InventoryMovementType,
    example: InventoryMovementType.STOCK_IN,
    description: 'Movement type (default: ADJUSTMENT or STOCK_IN / STOCK_OUT based on sign)',
  })
  @IsOptional()
  @IsEnum(InventoryMovementType)
  movementType?: InventoryMovementType;

  @ApiPropertyOptional({
    example: 'Restocked new shipment from supplier',
    description: 'Reason for inventory adjustment',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: 'SHIPMENT',
    description: 'Reference type (e.g. SHIPMENT, MANUAL, RETURN)',
  })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({
    example: 'SHIP_2026_9981',
    description: 'Reference ID',
  })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({
    example: 'idemp_key_adj_001',
    description: 'Idempotency key to prevent duplicate adjustments',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
