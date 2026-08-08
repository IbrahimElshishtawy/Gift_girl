import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'User email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'User phone number in E.164 format' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'P@ssword123!', description: 'Strong password (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)' })
  @IsString()
  @MinLength(8)
  password!: string;
}
