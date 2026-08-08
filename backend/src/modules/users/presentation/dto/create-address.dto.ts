import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home', description: 'Address label' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'Ibrahim Elshishtawy', description: 'Recipient full name' })
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty({ example: '+201012345678', description: 'Contact phone number' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'Egypt', description: 'Country name' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'Gharbia', description: 'Governorate or state' })
  @IsString()
  @IsNotEmpty()
  governorateState!: string;

  @ApiProperty({ example: 'Tanta', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiPropertyOptional({ example: 'El-Galaa', description: 'District or area' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ example: 'Main Street, Building 4', description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  street!: string;

  @ApiPropertyOptional({ example: 'Building B', description: 'Building number or name' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: 'Apt 12', description: 'Apartment number' })
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiPropertyOptional({ example: '3rd Floor', description: 'Floor number' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: '31511', description: 'Postal code' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: true, description: 'Set as default address' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
