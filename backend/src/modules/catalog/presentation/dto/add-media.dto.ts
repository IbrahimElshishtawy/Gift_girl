import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ProductMediaType } from '@prisma/client';

export class AddMediaDto {
  @ApiPropertyOptional({
    enum: ProductMediaType,
    example: ProductMediaType.IMAGE,
    description: 'Media type',
  })
  @IsOptional()
  @IsEnum(ProductMediaType)
  type?: ProductMediaType;

  @ApiProperty({
    example: 'https://storage.marketplace.com/products/dress1.jpg',
    description: 'Public image/video URL',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiPropertyOptional({ example: 'Front view of Floral Maxi Dress', description: 'Alt text' })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ example: 0, description: 'Display sort order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, description: 'Set as primary main product image' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
