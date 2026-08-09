import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class AdminUpdateUserStatusDto {
  @ApiProperty({
    enum: UserStatus,
    description: 'Target user status (ACTIVE, SUSPENDED, DISABLED)',
  })
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status!: UserStatus;

  @ApiPropertyOptional({
    example: 'Violating platform guidelines',
    description: 'Reason for status transition',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
