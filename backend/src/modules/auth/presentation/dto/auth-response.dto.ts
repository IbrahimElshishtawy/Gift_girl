import { ApiProperty } from '@nestjs/swagger';
import { SafeUser } from '../../../users/domain/user-status.enum';

export class AuthTokenData {
  @ApiProperty({ description: 'JWT Access Token' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh Token' })
  refreshToken!: string;

  @ApiProperty({ description: 'Access token expiration in seconds', example: 900 })
  expiresIn!: number;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'User identity details' })
  user!: SafeUser;

  @ApiProperty({ description: 'Authentication tokens' })
  tokens!: AuthTokenData;
}
