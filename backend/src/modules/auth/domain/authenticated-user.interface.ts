import { UserRole, UserStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  sessionId: string;
}

export interface JwtAccessTokenPayload {
  sub: string;
  sessionId: string;
  role: UserRole;
  type: 'access';
  iat?: number;
  exp?: number;
}
