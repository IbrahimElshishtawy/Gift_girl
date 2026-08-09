import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Dresses', description: 'Category display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'dresses', description: 'Unique category URL slug' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain lowercase letters, numbers, and hyphens only',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Women dresses collection', description: 'Category description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/dresses.png', description: 'Category banner/icon image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'cat_clothing_123', description: 'Parent category UUID if subcategory' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 1, description: 'Display sort order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
