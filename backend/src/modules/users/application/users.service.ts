import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersRepository } from '../infrastructure/users.repository';
import { User, Prisma, UserStatus, UserRole } from '@prisma/client';
import { UserEntity } from '../domain/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(data: {
    email?: string;
    phone?: string;
    passwordHash: string;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<UserEntity> {
    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : undefined;
    const normalizedPhone = data.phone ? data.phone.trim() : undefined;

    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException('At least one identity contact (email or phone) is required.');
    }

    if (normalizedEmail) {
      const existingEmail = await this.usersRepository.findByEmail(normalizedEmail);
      if (existingEmail) {
        throw new ConflictException('An account with this email address already exists.');
      }
    }

    if (normalizedPhone) {
      const existingPhone = await this.usersRepository.findByPhone(normalizedPhone);
      if (existingPhone) {
        throw new ConflictException('An account with this phone number already exists.');
      }
    }

    const newUser = await this.usersRepository.create({
      email: normalizedEmail || null,
      phone: normalizedPhone || null,
      passwordHash: data.passwordHash,
      role: data.role || UserRole.CUSTOMER,
      status: data.status || UserStatus.PENDING_VERIFICATION,
    });

    return new UserEntity(newUser);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.usersRepository.findById(id);
    return user ? new UserEntity(user) : null;
  }

  async findByIdentity(identity: string): Promise<UserEntity | null> {
    const user = await this.usersRepository.findByIdentity(identity);
    return user ? new UserEntity(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.usersRepository.findByEmail(email);
    return user ? new UserEntity(user) : null;
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    const user = await this.usersRepository.findByPhone(phone);
    return user ? new UserEntity(user) : null;
  }

  async updatePasswordHash(id: string, newPasswordHash: string): Promise<UserEntity> {
    const updated = await this.usersRepository.update(id, {
      passwordHash: newPasswordHash,
    });
    return new UserEntity(updated);
  }

  async updateEmailVerified(id: string, emailVerified: boolean): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const newStatus =
      user.status === UserStatus.PENDING_VERIFICATION && emailVerified
        ? UserStatus.ACTIVE
        : user.status;

    const updated = await this.usersRepository.update(id, {
      emailVerified,
      status: newStatus,
    });
    return new UserEntity(updated);
  }

  async updatePhoneVerified(id: string, phoneVerified: boolean): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const newStatus =
      user.status === UserStatus.PENDING_VERIFICATION && phoneVerified
        ? UserStatus.ACTIVE
        : user.status;

    const updated = await this.usersRepository.update(id, {
      phoneVerified,
      status: newStatus,
    });
    return new UserEntity(updated);
  }

  async recordSuccessfulLogin(id: string, ipAddress?: string): Promise<UserEntity> {
    const updated = await this.usersRepository.recordSuccessfulLogin(id, ipAddress);
    return new UserEntity(updated);
  }

  async incrementFailedLogin(id: string, lockoutUntil?: Date): Promise<UserEntity> {
    const updated = await this.usersRepository.incrementFailedLogin(id, lockoutUntil);
    return new UserEntity(updated);
  }

  async resetFailedLoginAttempts(id: string): Promise<UserEntity> {
    const updated = await this.usersRepository.resetFailedLoginAttempts(id);
    return new UserEntity(updated);
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserEntity> {
    const updated = await this.usersRepository.updateStatus(id, status);
    return new UserEntity(updated);
  }
}
