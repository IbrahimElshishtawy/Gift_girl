import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateInventorySettingsDto {
  @ApiPropertyOptional({
    example: 15,
    description: 'Low stock threshold for triggering LOW_STOCK status',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
