import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SellerStatus } from '@prisma/client';

export class AdminUpdateSellerStatusDto {
  @ApiProperty({
    enum: SellerStatus,
    example: SellerStatus.ACTIVE,
    description: 'Target seller status',
  })
  @IsEnum(SellerStatus)
  @IsNotEmpty()
  status!: SellerStatus;

  @ApiPropertyOptional({
    example: 'Verified identity and business documents',
    description: 'Reason for status update',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
