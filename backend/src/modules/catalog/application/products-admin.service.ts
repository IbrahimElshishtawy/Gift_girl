import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProductsRepository } from '../infrastructure/products.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { ProductEntity } from '../domain/product.entity';
import { ProductStatus, SecurityEventType, Prisma } from '@prisma/client';

@Injectable()
export class ProductsAdminService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async listProductsAdmin(params: {
    page?: number;
    limit?: number;
    status?: ProductStatus;
    categoryId?: string;
    storeId?: string;
    brandId?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }

    if (params.storeId) {
      where.storeId = params.storeId;
    }

    if (params.brandId) {
      where.brandId = params.brandId;
    }

    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ];
    }

    const { items, total } = await this.productsRepository.findMany({
      skip,
      take: limit,
      where,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(ProductEntity.fromPrisma),
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

  async getProductByIdAdmin(id: string): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(id);
    if (!product) throw new NotFoundException('Product not found.');
    return ProductEntity.fromPrisma(product);
  }

  async approveProductAdmin(
    adminUserId: string,
    productId: string,
    publishImmediately = true,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found.');

    if (
      product.status !== ProductStatus.PENDING_REVIEW &&
      product.status !== ProductStatus.DRAFT
    ) {
      throw new BadRequestException(`Product cannot be approved from status '${product.status}'.`);
    }

    const targetStatus = publishImmediately
      ? ProductStatus.PUBLISHED
      : ProductStatus.APPROVED;

    const updated = await this.productsRepository.updateStatus(productId, targetStatus);

    const event = targetStatus === ProductStatus.PUBLISHED
      ? SecurityEventType.PRODUCT_PUBLISHED
      : SecurityEventType.PRODUCT_APPROVED;

    await this.securityAuditService.logEvent(event, adminUserId, ipAddress, userAgent, {
      productId,
      previousStatus: product.status,
      newStatus: targetStatus,
    });

    const fullProduct = await this.productsRepository.findById(updated.id);
    return ProductEntity.fromPrisma(fullProduct!);
  }

  async rejectProductAdmin(
    adminUserId: string,
    productId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found.');

    const updated = await this.productsRepository.updateStatus(
      productId,
      ProductStatus.REJECTED,
      reason,
    );

    await this.securityAuditService.logEvent(
      SecurityEventType.PRODUCT_REJECTED,
      adminUserId,
      ipAddress,
      userAgent,
      { productId, reason },
    );

    const fullProduct = await this.productsRepository.findById(updated.id);
    return ProductEntity.fromPrisma(fullProduct!);
  }

  async archiveProductAdmin(
    adminUserId: string,
    productId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found.');

    const updated = await this.productsRepository.updateStatus(
      productId,
      ProductStatus.ARCHIVED,
    );

    await this.securityAuditService.logEvent(
      SecurityEventType.PRODUCT_ARCHIVED,
      adminUserId,
      ipAddress,
      userAgent,
      { productId },
    );

    const fullProduct = await this.productsRepository.findById(updated.id);
    return ProductEntity.fromPrisma(fullProduct!);
  }
}
