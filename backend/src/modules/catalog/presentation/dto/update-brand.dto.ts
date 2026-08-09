import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BrandStatus } from '@prisma/client';

export class UpdateBrandDto {
  @ApiPropertyOptional({ example: 'Chanel Paris', description: 'Updated brand name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/chanel-logo.png',
    description: 'Updated logo URL',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'High fashion and luxury beauty products',
    description: 'Updated brand description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: BrandStatus, description: 'Brand status' })
  @IsOptional()
  @IsEnum(BrandStatus)
  status?: BrandStatus;
}
