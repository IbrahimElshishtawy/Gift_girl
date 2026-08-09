import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateSellerProfileDto {
  @ApiPropertyOptional({ example: 'Lotus Fashion & Apparel', description: 'Updated business name' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ example: 'Lotus Trading LLC', description: 'Legal registered name' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: 'Premium women fashion and handmade gifts', description: 'Business description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '+201012345678', description: 'Updated contact phone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@lotusfashion.com', description: 'Updated contact email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Egypt', description: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Cairo', description: 'Governorate or State' })
  @IsOptional()
  @IsString()
  governorateState?: string;

  @ApiPropertyOptional({ example: 'New Cairo', description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '90th Street North, Bld 12', description: 'Street address' })
  @IsOptional()
  @IsString()
  address?: string;
}
