import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Chanel', description: 'Brand name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'chanel', description: 'Unique brand URL slug' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain lowercase letters, numbers, and hyphens only',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/chanel.png', description: 'Brand logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'Luxury French fashion house', description: 'Brand description' })
  @IsOptional()
  @IsString()
  description?: string;
}
