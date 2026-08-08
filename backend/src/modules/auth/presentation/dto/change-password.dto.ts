import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    description: 'New strong password (min 8 chars, 1 upper, 1 lower, 1 number, 1 special)',
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
