import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddSellerStaffDto {
  @ApiProperty({ example: 'usr_staff_123', description: 'Target user ID to add as seller staff' })
  @IsString()
  @IsNotEmpty()
  targetUserId!: string;

  @ApiPropertyOptional({ example: 'CATALOG_STAFF', description: 'Staff role within the seller team' })
  @IsOptional()
  @IsString()
  role?: string;
}
