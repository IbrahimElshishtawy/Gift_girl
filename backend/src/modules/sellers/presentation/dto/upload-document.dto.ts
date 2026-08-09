import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SellerDocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({
    enum: SellerDocumentType,
    example: SellerDocumentType.BUSINESS_LICENSE,
    description: 'Document type',
  })
  @IsEnum(SellerDocumentType)
  @IsNotEmpty()
  type!: SellerDocumentType;

  @ApiProperty({
    example: 'storage://documents/license_2026.pdf',
    description: 'Object storage file reference or URL key',
  })
  @IsString()
  @IsNotEmpty()
  fileReference!: string;

  @ApiPropertyOptional({ example: 'Business_License_2026.pdf', description: 'Original document file name' })
  @IsOptional()
  @IsString()
  fileName?: string;
}
