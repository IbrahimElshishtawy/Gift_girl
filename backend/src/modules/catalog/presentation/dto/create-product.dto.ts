import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ProductVisibility } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'cat_dresses_123', description: 'Category UUID' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiPropertyOptional({ example: 'brd_chanel_123', description: 'Brand UUID' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({ example: 'Floral Summer Maxi Dress', description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'floral-summer-maxi-dress', description: 'Store-unique product slug' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain lowercase letters, numbers, and hyphens only',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Lightweight handmade cotton dress', description: 'Short summary' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ example: '<p>Beautiful handcrafted dress with breathable cotton...</p>', description: 'Full description HTML' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 499.99, description: 'Base selling price' })
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({ example: 699.99, description: 'Original compare-at price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ example: 'EGP', description: 'Currency code' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: ProductVisibility, example: ProductVisibility.PUBLIC, description: 'Product visibility' })
  @IsOptional()
  @IsEnum(ProductVisibility)
  visibility?: ProductVisibility;
}
