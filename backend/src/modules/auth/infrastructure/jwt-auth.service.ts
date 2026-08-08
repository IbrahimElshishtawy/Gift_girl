import { Injectable, Logger, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import authConfig from '../../../config/auth.config';
import { JwtAccessTokenPayload } from '../domain/authenticated-user.interface';
import { UserRole } from '@prisma/client';

@Injectable()
export class JwtAuthService {
  private readonly logger = new Logger(JwtAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  generateAccessToken(userId: string, sessionId: string, role: UserRole): string {
    const payload: JwtAccessTokenPayload = {
      sub: userId,
      sessionId,
      role,
      type: 'access',
    };

    return this.jwtService.sign(payload as object, {
      secret: this.config.jwtAccessSecret,
      expiresIn: this.config.jwtAccessExpiresIn as unknown as number,
    });
  }

  verifyAccessToken(token: string): JwtAccessTokenPayload {
    try {
      const payload = this.jwtService.verify<JwtAccessTokenPayload>(token, {
        secret: this.config.jwtAccessSecret,
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type.');
      }

      return payload;
    } catch (error) {
      this.logger.debug(`JWT Access Token verification failed:`, error);
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
