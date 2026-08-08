import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'CONTENT_MANAGER', description: 'Unique role code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, { message: 'Code must contain uppercase letters, numbers, and underscores only' })
  code!: string;

  @ApiProperty({ example: 'Content Manager', description: 'Role display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Manages platform marketing and banner content', description: 'Role description' })
  @IsOptional()
  @IsString()
  description?: string;
}
