import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyAccountDto {
  @ApiProperty({ description: 'Verification token or OTP code' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
