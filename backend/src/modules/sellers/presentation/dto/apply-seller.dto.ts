import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplySellerDto {
  @ApiProperty({ example: 'Lotus Fashion Boutique', description: 'Business trading name' })
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @ApiPropertyOptional({ example: 'LLC', description: 'Type of business entity' })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({ example: '123-456-789', description: 'Tax registration number' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'CR-987654', description: 'Commercial register number' })
  @IsOptional()
  @IsString()
  commercialRegister?: string;

  @ApiProperty({ example: '+201012345678', description: 'Business contact phone' })
  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @ApiProperty({ example: 'contact@lotusfashion.com', description: 'Business contact email' })
  @IsEmail()
  @IsNotEmpty()
  contactEmail!: string;

  @ApiPropertyOptional({ example: 'We specialize in handcrafted women dresses', description: 'Application notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
