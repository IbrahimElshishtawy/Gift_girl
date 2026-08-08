import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address or phone number' })
  @IsString()
  @IsNotEmpty()
  identity!: string;

  @ApiProperty({ example: 'P@ssword123!', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
