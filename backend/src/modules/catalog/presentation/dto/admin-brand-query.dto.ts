import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BrandStatus } from '@prisma/client';

export class AdminBrandQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Page size limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: BrandStatus, description: 'Filter by brand status' })
  @IsOptional()
  @IsEnum(BrandStatus)
  status?: BrandStatus;

  @ApiPropertyOptional({ example: 'Chanel', description: 'Search term for brand name or slug' })
  @IsOptional()
  @IsString()
  search?: string;
}
