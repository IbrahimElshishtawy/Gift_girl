import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AdminAssignRolesDto {
  @ApiProperty({
    example: ['ADMIN', 'SELLER'],
    description: 'Array of role codes to assign to target user',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles!: string[];
}
