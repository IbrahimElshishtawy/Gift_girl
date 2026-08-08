import { User as PrismaUser, UserStatus, UserRole } from '@prisma/client';
import { SafeUser } from './user-status.enum';

export class UserEntity implements PrismaUser {
  id!: string;
  email!: string | null;
  phone!: string | null;
  passwordHash!: string;
  status!: UserStatus;
  emailVerified!: boolean;
  phoneVerified!: boolean;
  role!: UserRole;
  failedLoginAttempts!: number;
  lockoutUntil!: Date | null;
  lastLoginAt!: Date | null;
  lastLoginIp!: string | null;
  deletedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<PrismaUser>) {
    Object.assign(this, partial);
  }

  toSafeUser(): SafeUser {
    return {
      id: this.id,
      email: this.email,
      phone: this.phone,
      status: this.status,
      emailVerified: this.emailVerified,
      phoneVerified: this.phoneVerified,
      role: this.role,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
