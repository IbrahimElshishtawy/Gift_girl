import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ example: 'Lotus Gift Store', description: 'Public store display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'lotus-gift-store', description: 'Unique collision-safe store URL slug' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain lowercase letters, numbers, and hyphens only',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'Handmade luxury gifts and accessories for women', description: 'Store description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png', description: 'Store logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/banner.png', description: 'Store banner URL' })
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiProperty({ example: 'store@lotusfashion.com', description: 'Store contact email' })
  @IsEmail()
  @IsNotEmpty()
  contactEmail!: string;

  @ApiProperty({ example: '+201012345678', description: 'Store contact phone' })
  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @ApiPropertyOptional({ example: 'Egypt', description: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'Cairo', description: 'Governorate / State' })
  @IsString()
  @IsNotEmpty()
  governorateState!: string;

  @ApiProperty({ example: 'Nasr City', description: 'City' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiPropertyOptional({ example: 'Abbas El Akkad St', description: 'Store location address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '14-day return policy for unused items', description: 'Return policy text' })
  @IsOptional()
  @IsString()
  returnPolicy?: string;

  @ApiPropertyOptional({ example: 'Express shipping within 48 hours across Egypt', description: 'Shipping policy text' })
  @IsOptional()
  @IsString()
  shippingPolicy?: string;
}
