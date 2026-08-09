import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({ example: 'DRESS-BLK-M', description: 'Unique Stock Keeping Unit (SKU)' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiPropertyOptional({ example: 499.99, description: 'Price override for this variant' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 699.99, description: 'Compare-at price override' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiProperty({
    example: ['opt_val_blk_123', 'opt_val_m_456'],
    description: 'Option value UUIDs forming this variant',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  optionValueIds!: string[];

  @ApiPropertyOptional({ example: false, description: 'Is default product variant' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
