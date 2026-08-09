import { Injectable } from '@nestjs/common';
import {
  UserAddressRepository,
  CreateAddressData,
  UpdateAddressData,
} from '../infrastructure/user-address.repository';
import { UserAddressEntity } from '../domain/user-address.entity';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { SecurityEventType } from '@prisma/client';

@Injectable()
export class UserAddressService {
  constructor(
    private readonly addressRepository: UserAddressRepository,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async getUserAddresses(userId: string): Promise<UserAddressEntity[]> {
    return this.addressRepository.findByUserId(userId);
  }

  async createAddress(
    userId: string,
    data: CreateAddressData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserAddressEntity> {
    const address = await this.addressRepository.createAddress(userId, data);

    await this.securityAuditService.logEvent(
      SecurityEventType.ADDRESS_CREATE,
      userId,
      ipAddress,
      userAgent,
      { addressId: address.id, isDefault: address.isDefault },
    );

    return address;
  }

  async updateAddress(
    id: string,
    userId: string,
    data: UpdateAddressData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserAddressEntity> {
    const updated = await this.addressRepository.updateAddress(id, userId, data);

    await this.securityAuditService.logEvent(
      SecurityEventType.ADDRESS_UPDATE,
      userId,
      ipAddress,
      userAgent,
      { addressId: id, updatedFields: Object.keys(data) },
    );

    return updated;
  }

  async deleteAddress(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.addressRepository.deleteAddress(id, userId);

    await this.securityAuditService.logEvent(
      SecurityEventType.ADDRESS_DELETE,
      userId,
      ipAddress,
      userAgent,
      { addressId: id },
    );
  }

  async setDefaultAddress(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserAddressEntity> {
    const defaultAddress = await this.addressRepository.setDefaultAddress(id, userId);

    await this.securityAuditService.logEvent(
      SecurityEventType.ADDRESS_UPDATE,
      userId,
      ipAddress,
      userAgent,
      { addressId: id, setAsDefault: true },
    );

    return defaultAddress;
  }
}
