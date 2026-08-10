import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    example: 3,
    description: 'New quantity for cart item (1 to 100)',
  })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}
