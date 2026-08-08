import { UserAddress as PrismaUserAddress } from '@prisma/client';

export class UserAddressEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly label: string,
    public readonly recipientName: string,
    public readonly phone: string,
    public readonly country: string,
    public readonly governorateState: string,
    public readonly city: string,
    public readonly district: string | null,
    public readonly street: string,
    public readonly building: string | null,
    public readonly apartment: string | null,
    public readonly floor: string | null,
    public readonly postalCode: string | null,
    public readonly isDefault: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaUserAddress): UserAddressEntity {
    return new UserAddressEntity(
      prisma.id,
      prisma.userId,
      prisma.label,
      prisma.recipientName,
      prisma.phone,
      prisma.country,
      prisma.governorateState,
      prisma.city,
      prisma.district,
      prisma.street,
      prisma.building,
      prisma.apartment,
      prisma.floor,
      prisma.postalCode,
      prisma.isDefault,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
