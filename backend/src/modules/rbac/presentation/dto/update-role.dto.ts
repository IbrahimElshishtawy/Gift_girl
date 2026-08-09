import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    example: 'Updated Content Manager',
    description: 'Updated role display name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated description for marketing and content management',
    description: 'Updated role description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
