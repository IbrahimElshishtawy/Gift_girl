import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CategoryStatus } from '@prisma/client';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Summer Dresses', description: 'Updated category name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated description',
    description: 'Updated category description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/summer-dresses.png',
    description: 'Updated image URL',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'cat_clothing_123', description: 'Updated parent category UUID' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 2, description: 'Updated sort order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: CategoryStatus, description: 'Category status' })
  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;
}
