import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthService } from '../../infrastructure/jwt-auth.service';
import { SessionService } from '../../infrastructure/session.service';
import { UsersService } from '../../../users/application/users.service';
import { UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../domain/authenticated-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtAuthService: JwtAuthService,
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token missing or invalid header scheme.');
    }

    const token = authHeader.substring(7).trim();
    const payload = this.jwtAuthService.verifyAccessToken(token);

    // Verify session validity in Redis / DB
    const isValidSession = await this.sessionService.isSessionValid(payload.sessionId);
    if (!isValidSession) {
      throw new UnauthorizedException('Session has expired or been revoked.');
    }

    // Verify user status
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status === UserStatus.DISABLED || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('User account is invalid or suspended.');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      sessionId: payload.sessionId,
    };

    request.user = authenticatedUser;
    return true;
  }
}
