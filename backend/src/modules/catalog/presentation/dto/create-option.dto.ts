import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OptionValueDto {
  @ApiProperty({ example: 'Black', description: 'Option value text' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ example: 0, description: 'Value position' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateOptionDto {
  @ApiProperty({ example: 'Color', description: 'Option dimension name (e.g. Color, Size)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 0, description: 'Option position' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiProperty({ type: [OptionValueDto], description: 'List of option values' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionValueDto)
  values!: OptionValueDto[];
}
