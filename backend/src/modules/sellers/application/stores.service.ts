import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { StoresRepository } from '../infrastructure/stores.repository';
import { SellersRepository } from '../infrastructure/sellers.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { StoreEntity } from '../domain/store.entity';
import { StoreStatus, SellerStatus, SecurityEventType, Prisma } from '@prisma/client';

export interface CreateStoreData {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  contactEmail: string;
  contactPhone: string;
  country?: string;
  governorateState: string;
  city: string;
  address?: string;
  returnPolicy?: string;
  shippingPolicy?: string;
}

export interface UpdateStoreData {
  name?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  country?: string;
  governorateState?: string;
  city?: string;
  address?: string;
  returnPolicy?: string;
  shippingPolicy?: string;
}

@Injectable()
export class StoresService {
  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly sellersRepository: SellersRepository,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async createStore(userId: string, data: CreateStoreData): Promise<StoreEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new ForbiddenException('Only registered sellers can create a store.');
    }

    if (seller.status !== SellerStatus.ACTIVE) {
      throw new ForbiddenException('Your seller account must be ACTIVE to create a store.');
    }

    const existingStore = await this.storesRepository.findBySellerId(seller.id);
    if (existingStore) {
      throw new ConflictException('Seller already owns a store.');
    }

    const normalizedSlug = data.slug.trim().toLowerCase();
    const existingSlug = await this.storesRepository.findBySlug(normalizedSlug);
    if (existingSlug) {
      throw new ConflictException(`Store slug '${normalizedSlug}' is already taken.`);
    }

    const store = await this.storesRepository.create({
      seller: { connect: { id: seller.id } },
      name: data.name.trim(),
      slug: normalizedSlug,
      description: data.description?.trim() || null,
      logoUrl: data.logoUrl?.trim() || null,
      bannerUrl: data.bannerUrl?.trim() || null,
      status: StoreStatus.DRAFT,
      contactEmail: data.contactEmail.trim().toLowerCase(),
      contactPhone: data.contactPhone.trim(),
      country: data.country?.trim() || 'Egypt',
      governorateState: data.governorateState.trim(),
      city: data.city.trim(),
      address: data.address?.trim() || null,
      returnPolicy: data.returnPolicy?.trim() || null,
      shippingPolicy: data.shippingPolicy?.trim() || null,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.STORE_CREATED,
      userId,
      undefined,
      undefined,
      { sellerId: seller.id, storeId: store.id, slug: store.slug },
    );

    return StoreEntity.fromPrisma(store);
  }

  async getMyStore(userId: string): Promise<StoreEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundException('Seller profile not found for this user.');
    }

    const store = await this.storesRepository.findBySellerId(seller.id);
    if (!store) {
      throw new NotFoundException('No store found for this seller.');
    }

    return StoreEntity.fromPrisma(store);
  }

  async updateStore(userId: string, data: UpdateStoreData): Promise<StoreEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) throw new NotFoundException('Seller profile not found.');

    const store = await this.storesRepository.findBySellerId(seller.id);
    if (!store) throw new NotFoundException('No store found for this seller.');

    const updated = await this.storesRepository.update(store.id, data);

    await this.securityAuditService.logEvent(
      SecurityEventType.STORE_UPDATED,
      userId,
      undefined,
      undefined,
      { sellerId: seller.id, storeId: store.id, updatedFields: Object.keys(data) },
    );

    return StoreEntity.fromPrisma(updated);
  }

  async submitStoreForReview(userId: string): Promise<StoreEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) throw new NotFoundException('Seller profile not found.');

    const store = await this.storesRepository.findBySellerId(seller.id);
    if (!store) throw new NotFoundException('No store found for this seller.');

    if (store.status !== StoreStatus.DRAFT) {
      throw new BadRequestException(`Store cannot be submitted from status '${store.status}'.`);
    }

    const updated = await this.storesRepository.updateStatus(store.id, StoreStatus.PENDING_REVIEW);

    await this.securityAuditService.logEvent(
      SecurityEventType.STORE_SUBMITTED,
      userId,
      undefined,
      undefined,
      { sellerId: seller.id, storeId: store.id },
    );

    return StoreEntity.fromPrisma(updated);
  }

  async getPublicStoreBySlug(slug: string): Promise<StoreEntity> {
    const normalizedSlug = slug.trim().toLowerCase();
    const store = await this.storesRepository.findBySlug(normalizedSlug);

    if (!store) {
      throw new NotFoundException(`Public store with slug '${normalizedSlug}' not found.`);
    }

    // Public Visibility Check: Store MUST be ACTIVE AND Seller MUST be ACTIVE
    if (store.status !== StoreStatus.ACTIVE || store.seller.status !== SellerStatus.ACTIVE) {
      throw new NotFoundException(`Public store with slug '${normalizedSlug}' not found.`);
    }

    return StoreEntity.fromPrisma(store);
  }

  async listStoresAdmin(params: {
    page?: number;
    limit?: number;
    status?: StoreStatus;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StoreWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
        { contactEmail: { contains: term, mode: 'insensitive' } },
      ];
    }

    const { items, total } = await this.storesRepository.findMany({
      skip,
      take: limit,
      where,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(StoreEntity.fromPrisma),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getStoreByIdAdmin(id: string): Promise<StoreEntity> {
    const store = await this.storesRepository.findById(id);
    if (!store) throw new NotFoundException('Store not found.');
    return StoreEntity.fromPrisma(store);
  }

  async updateStoreStatusAdmin(
    adminUserId: string,
    storeId: string,
    newStatus: StoreStatus,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<StoreEntity> {
    const store = await this.storesRepository.findById(storeId);
    if (!store) throw new NotFoundException('Store not found.');

    const updated = await this.storesRepository.updateStatus(storeId, newStatus, reason);

    const eventMap: Record<StoreStatus, SecurityEventType> = {
      [StoreStatus.ACTIVE]: SecurityEventType.STORE_ACTIVATED,
      [StoreStatus.SUSPENDED]: SecurityEventType.STORE_SUSPENDED,
      [StoreStatus.DISABLED]: SecurityEventType.STORE_SUSPENDED,
      [StoreStatus.PENDING_REVIEW]: SecurityEventType.STORE_SUBMITTED,
      [StoreStatus.DRAFT]: SecurityEventType.STORE_UPDATED,
      [StoreStatus.CLOSED]: SecurityEventType.STORE_SUSPENDED,
    };

    await this.securityAuditService.logEvent(
      eventMap[newStatus] || SecurityEventType.STORE_UPDATED,
      adminUserId,
      ipAddress,
      userAgent,
      { storeId, previousStatus: store.status, newStatus, reason },
    );

    return StoreEntity.fromPrisma(updated);
  }
}
