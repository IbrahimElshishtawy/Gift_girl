import { UserStatus, UserRole } from '@prisma/client';

export { UserStatus, UserRole };

export interface SafeUser {
  id: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: UserRole;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
