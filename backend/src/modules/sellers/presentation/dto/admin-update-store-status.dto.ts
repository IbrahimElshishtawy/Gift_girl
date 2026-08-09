import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StoreStatus } from '@prisma/client';

export class AdminUpdateStoreStatusDto {
  @ApiProperty({
    enum: StoreStatus,
    example: StoreStatus.ACTIVE,
    description: 'Target store status',
  })
  @IsEnum(StoreStatus)
  @IsNotEmpty()
  status!: StoreStatus;

  @ApiPropertyOptional({
    example: 'Store complies with marketplace catalog standards',
    description: 'Reason for status update',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
