import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MergeCartDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
    description: 'Guest cart secure token to merge into authenticated cart',
  })
  @IsString()
  @IsNotEmpty()
  guestToken!: string;
}
