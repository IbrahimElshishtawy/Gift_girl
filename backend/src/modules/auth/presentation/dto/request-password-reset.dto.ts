import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'user@example.com', description: 'Registered email or phone number' })
  @IsString()
  @IsNotEmpty()
  identity!: string;
}
