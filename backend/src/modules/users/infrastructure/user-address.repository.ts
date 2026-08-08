import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UserAddressEntity } from '../domain/user-address.entity';

export interface CreateAddressData {
  label?: string;
  recipientName: string;
  phone: string;
  country?: string;
  governorateState: string;
  city: string;
  district?: string;
  street: string;
  building?: string;
  apartment?: string;
  floor?: string;
  postalCode?: string;
  isDefault?: boolean;
}

export interface UpdateAddressData {
  label?: string;
  recipientName?: string;
  phone?: string;
  country?: string;
  governorateState?: string;
  city?: string;
  district?: string;
  street?: string;
  building?: string;
  apartment?: string;
  floor?: string;
  postalCode?: string;
  isDefault?: boolean;
}

@Injectable()
export class UserAddressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<UserAddressEntity[]> {
    const records = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map(UserAddressEntity.fromPrisma);
  }

  async findById(id: string): Promise<UserAddressEntity | null> {
    const record = await this.prisma.userAddress.findUnique({
      where: { id },
    });
    return record ? UserAddressEntity.fromPrisma(record) : null;
  }

  async createAddress(userId: string, data: CreateAddressData): Promise<UserAddressEntity> {
    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.userAddress.count({ where: { userId } });
      const makeDefault = data.isDefault || existingCount === 0;

      if (makeDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const created = await tx.userAddress.create({
        data: {
          userId,
          label: data.label || 'Home',
          recipientName: data.recipientName,
          phone: data.phone,
          country: data.country || 'Egypt',
          governorateState: data.governorateState,
          city: data.city,
          district: data.district,
          street: data.street,
          building: data.building,
          apartment: data.apartment,
          floor: data.floor,
          postalCode: data.postalCode,
          isDefault: makeDefault,
        },
      });

      return UserAddressEntity.fromPrisma(created);
    });
  }

  async updateAddress(
    id: string,
    userId: string,
    data: UpdateAddressData,
  ): Promise<UserAddressEntity> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userAddress.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundException('Address not found or unauthorized.');
      }

      if (data.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const updated = await tx.userAddress.update({
        where: { id },
        data: {
          ...data,
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
      });

      return UserAddressEntity.fromPrisma(updated);
    });
  }

  async deleteAddress(id: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userAddress.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundException('Address not found or unauthorized.');
      }

      await tx.userAddress.delete({ where: { id } });

      if (existing.isDefault) {
        const nextAddress = await tx.userAddress.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        if (nextAddress) {
          await tx.userAddress.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  async setDefaultAddress(id: string, userId: string): Promise<UserAddressEntity> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.userAddress.findFirst({
        where: { id, userId },
      });

      if (!target) {
        throw new NotFoundException('Address not found or unauthorized.');
      }

      await tx.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      const updated = await tx.userAddress.update({
        where: { id },
        data: { isDefault: true },
      });

      return UserAddressEntity.fromPrisma(updated);
    });
  }
}
