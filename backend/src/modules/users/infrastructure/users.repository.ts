import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { User, Prisma, UserStatus, UserRole } from '@prisma/client';

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        deletedAt: null,
      },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    const normalizedPhone = phone.trim();
    return this.prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        deletedAt: null,
      },
    });
  }

  async findByIdentity(emailOrPhone: string): Promise<User | null> {
    const normalized = emailOrPhone.trim().toLowerCase();
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalized }, { phone: emailOrPhone.trim() }],
        deletedAt: null,
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  async recordSuccessfulLogin(id: string, ipAddress?: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress || null,
      },
    });
  }

  async incrementFailedLogin(id: string, lockoutUntil?: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: { increment: 1 },
        ...(lockoutUntil ? { lockoutUntil, status: UserStatus.LOCKED } : {}),
      },
    });
  }

  async resetFailedLoginAttempts(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });
  }
}
