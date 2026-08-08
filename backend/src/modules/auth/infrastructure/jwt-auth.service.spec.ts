import { JwtAuthService } from './jwt-auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import authConfig from '../../../config/auth.config';
import { UserRole } from '@prisma/client';

describe('JwtAuthService', () => {
  let jwtAuthService: JwtAuthService;
  let jwtService: JwtService;

  const mockConfig = {
    jwtAccessSecret: 'super-secret-key-1234567890123456',
    jwtAccessExpiresIn: '15m',
  };

  beforeEach(() => {
    jwtService = new JwtService();
    jwtAuthService = new JwtAuthService(
      jwtService,
      mockConfig as unknown as ConfigType<typeof authConfig>,
    );
  });

  it('should generate and verify access tokens with claims', () => {
    const userId = 'user-uuid-12345';
    const sessionId = 'session-uuid-67890';
    const role = UserRole.CUSTOMER;

    const token = jwtAuthService.generateAccessToken(userId, sessionId, role);
    expect(token).toBeDefined();

    const payload = jwtAuthService.verifyAccessToken(token);
    expect(payload.sub).toBe(userId);
    expect(payload.sessionId).toBe(sessionId);
    expect(payload.role).toBe(role);
    expect(payload.type).toBe('access');
  });
});
