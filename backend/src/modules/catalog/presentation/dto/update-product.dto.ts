import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ProductVisibility } from '@prisma/client';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'cat_dresses_123', description: 'Updated Category UUID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'brd_chanel_123', description: 'Updated Brand UUID' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    example: 'Updated Floral Maxi Dress',
    description: 'Updated Product Name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated short description', description: 'Short summary' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({
    example: '<p>Updated full description</p>',
    description: 'Full description HTML',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 549.99, description: 'Updated base price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ example: 749.99, description: 'Updated compare-at price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ example: 'EGP', description: 'Currency code' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: ProductVisibility, description: 'Visibility' })
  @IsOptional()
  @IsEnum(ProductVisibility)
  visibility?: ProductVisibility;
}
