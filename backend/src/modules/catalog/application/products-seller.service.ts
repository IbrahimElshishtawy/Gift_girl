import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ProductsRepository } from '../infrastructure/products.repository';
import { ProductVariantsRepository } from '../infrastructure/product-variants.repository';
import { CategoriesRepository } from '../infrastructure/categories.repository';
import { SellersRepository } from '../../sellers/infrastructure/sellers.repository';
import { StoresRepository } from '../../sellers/infrastructure/stores.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { ProductEntity } from '../domain/product.entity';
import { ProductVariantEntity } from '../domain/product-variant.entity';
import { ProductMediaEntity } from '../domain/product-media.entity';
import {
  ProductStatus,
  ProductVisibility,
  CategoryStatus,
  SellerStatus,
  ProductMediaType,
  SecurityEventType,
  Prisma,
} from '@prisma/client';

export interface CreateProductData {
  categoryId: string;
  brandId?: string;
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  basePrice: number;
  compareAtPrice?: number;
  currency?: string;
  visibility?: ProductVisibility;
}

export interface UpdateProductData {
  categoryId?: string;
  brandId?: string;
  name?: string;
  shortDescription?: string;
  description?: string;
  basePrice?: number;
  compareAtPrice?: number;
  currency?: string;
  visibility?: ProductVisibility;
}

export interface CreateVariantData {
  sku: string;
  price?: number;
  compareAtPrice?: number;
  optionValueIds: string[];
  isDefault?: boolean;
}

export interface CreateOptionData {
  name: string;
  position?: number;
  values: { value: string; position?: number }[];
}

export interface AddMediaData {
  type?: ProductMediaType;
  url: string;
  altText?: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

@Injectable()
export class ProductsSellerService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly variantsRepository: ProductVariantsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly sellersRepository: SellersRepository,
    private readonly storesRepository: StoresRepository,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  private sanitizeHtml(html?: string | null): string | null {
    if (!html) return null;
    // Strip scripts and dangerous executable HTML tags
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:[^"]*/gi, '');
  }

  private async getAuthenticatedStore(userId: string) {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new ForbiddenException('Only registered sellers can manage products.');
    }
    if (seller.status !== SellerStatus.ACTIVE) {
      throw new ForbiddenException('Your seller account must be ACTIVE to manage products.');
    }

    const store = await this.storesRepository.findBySellerId(seller.id);
    if (!store) {
      throw new NotFoundException('Store profile not found for this seller.');
    }

    return { seller, store };
  }

  async listSellerProducts(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      status?: ProductStatus;
      categoryId?: string;
      search?: string;
    },
  ) {
    const { store } = await this.getAuthenticatedStore(userId);

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      storeId: store.id,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.categoryId) {
      where.categoryId = params.categoryId;
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

  async getSellerProductById(userId: string, productId: string): Promise<ProductEntity> {
    const { store } = await this.getAuthenticatedStore(userId);
    const product = await this.productsRepository.findById(productId);

    if (!product || product.storeId !== store.id) {
      throw new NotFoundException('Product not found in your store.');
    }

    return ProductEntity.fromPrisma(product);
  }

  async createProduct(userId: string, data: CreateProductData): Promise<ProductEntity> {
    const { store } = await this.getAuthenticatedStore(userId);

    const category = await this.categoriesRepository.findById(data.categoryId);
    if (!category || category.status !== CategoryStatus.ACTIVE) {
      throw new BadRequestException('Target category is invalid or inactive.');
    }

    const slug = data.slug ? this.slugify(data.slug) : this.slugify(data.name);

    const existingSlug = await this.productsRepository.findByStoreAndSlug(store.id, slug);
    if (existingSlug) {
      throw new ConflictException(`Product slug '${slug}' is already used in your store.`);
    }

    if (data.basePrice < 0) {
      throw new BadRequestException('Base price cannot be negative.');
    }

    if (data.compareAtPrice !== undefined && data.compareAtPrice < data.basePrice) {
      throw new BadRequestException(
        'Compare-at price must be greater than or equal to base price.',
      );
    }

    const product = await this.productsRepository.create({
      store: { connect: { id: store.id } },
      category: { connect: { id: category.id } },
      brand: data.brandId ? { connect: { id: data.brandId } } : undefined,
      name: data.name.trim(),
      slug,
      shortDescription: data.shortDescription?.trim() || null,
      description: this.sanitizeHtml(data.description),
      status: ProductStatus.DRAFT,
      visibility: data.visibility || ProductVisibility.PUBLIC,
      basePrice: data.basePrice,
      compareAtPrice: data.compareAtPrice || null,
      currency: data.currency || 'EGP',
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.PRODUCT_CREATED,
      userId,
      undefined,
      undefined,
      { productId: product.id, storeId: store.id, name: product.name, slug: product.slug },
    );

    const fullProduct = await this.productsRepository.findById(product.id);
    return ProductEntity.fromPrisma(fullProduct!);
  }

  async updateProduct(
    userId: string,
    productId: string,
    data: UpdateProductData,
  ): Promise<ProductEntity> {
    const { store } = await this.getAuthenticatedStore(userId);
    const product = await this.productsRepository.findById(productId);

    if (!product || product.storeId !== store.id) {
      throw new NotFoundException('Product not found in your store.');
    }

    if (data.categoryId) {
      const category = await this.categoriesRepository.findById(data.categoryId);
      if (!category || category.status !== CategoryStatus.ACTIVE) {
        throw new BadRequestException('Target category is invalid or inactive.');
      }
    }

    if (data.basePrice !== undefined && data.basePrice < 0) {
      throw new BadRequestException('Base price cannot be negative.');
    }

    const effectiveBasePrice =
      data.basePrice !== undefined ? data.basePrice : Number(product.basePrice);
    if (data.compareAtPrice !== undefined && data.compareAtPrice < effectiveBasePrice) {
      throw new BadRequestException(
        'Compare-at price must be greater than or equal to base price.',
      );
    }

    const updated = await this.productsRepository.update(productId, {
      category: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
      brand:
        data.brandId !== undefined
          ? data.brandId
            ? { connect: { id: data.brandId } }
            : { disconnect: true }
          : undefined,
      name: data.name?.trim(),
      shortDescription:
        data.shortDescription !== undefined ? data.shortDescription.trim() || null : undefined,
      description: data.description !== undefined ? this.sanitizeHtml(data.description) : undefined,
      basePrice: data.basePrice,
      compareAtPrice: data.compareAtPrice !== undefined ? data.compareAtPrice : undefined,
      currency: data.currency,
      visibility: data.visibility,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.PRODUCT_UPDATED,
      userId,
      undefined,
      undefined,
      { productId, storeId: store.id, updatedFields: Object.keys(data) },
    );

    const fullProduct = await this.productsRepository.findById(updated.id);
    return ProductEntity.fromPrisma(fullProduct!);
  }

  async submitProductForReview(userId: string, productId: string): Promise<ProductEntity> {
    const { store } = await this.getAuthenticatedStore(userId);
    const product = await this.productsRepository.findById(productId);

    if (!product || product.storeId !== store.id) {
      throw new NotFoundException('Product not found in your store.');
    }

    if (product.status !== ProductStatus.DRAFT && product.status !== ProductStatus.REJECTED) {
      throw new BadRequestException(`Product cannot be submitted from status '${product.status}'.`);
    }

    const updated = await this.productsRepository.updateStatus(
      productId,
      ProductStatus.PENDING_REVIEW,
    );

    await this.securityAuditService.logEvent(
      SecurityEventType.PRODUCT_SUBMITTED,
      userId,
      undefined,
      undefined,
      { productId, storeId: store.id },
    );

    const fullProduct = await this.productsRepository.findById(updated.id);
    return ProductEntity.fromPrisma(fullProduct!);
  }

  async archiveProduct(userId: string, productId: string): Promise<ProductEntity> {
    const { store } = await this.getAuthenticatedStore(userId);
    const product = await this.productsRepository.findById(productId);

    if (!product || product.storeId !== store.id) {
      throw new NotFoundException('Product not found in your store.');
    }

    const updated = await this.productsRepository.updateStatus(productId, ProductStatus.ARCHIVED);

    await this.securityAuditService.logEvent(
      SecurityEventType.PRODUCT_ARCHIVED,
      userId,
      undefined,
      undefined,
      { productId, storeId: store.id },
    );

    const fullProduct = await this.productsRepository.findById(updated.id);
    return ProductEntity.fromPrisma(fullProduct!);
  }

  async createOption(
    userId: string,
    productId: string,
    data: CreateOptionData,
  ): Promise<ProductEntity> {
    const { store } = await this.getAuthenticatedStore(userId);
    const product = await this.productsRepository.findById(productId);

    if (!product || product.storeId !== store.id) {
      throw new NotFoundException('Product not found in your store.');
    }

    const option = await this.variantsRepository.createOption(
      productId,
      data.name,
      data.position || 0,
    );

    for (const val of data.values) {
      await this.variantsRepository.createOptionValue(option.id, val.value, val.position || 0);
    }

    const fullProduct = await this.productsRepository.findById(productId);
    return ProductEntity.fromPrisma(fullProduct!);
  }

  async addVariant(
    userId: string,
    productId: string,
    data: CreateVariantData,
  ): Promise<ProductVariantEntity> {
    const { store } = await this.getAuthenticatedStore(userId);
    const product = await this.productsRepository.findById(productId);

    if (!product || product.storeId !== store.id) {
      throw new NotFoundException('Product not found in your store.');
    }

    const existingSku = await this.variantsRepository.findVariantBySku(data.sku);
    if (existingSku) {
      throw new ConflictException(`Variant SKU '${data.sku.toUpperCase()}' already exists.`);
    }

    try {
      const variant = await this.variantsRepository.createVariant(
        productId,
        data.sku,
        data.price !== undefined ? data.price : null,
        data.compareAtPrice !== undefined ? data.compareAtPrice : null,
        data.optionValueIds,
        data.isDefault || false,
      );

      await this.securityAuditService.logEvent(
        SecurityEventType.PRODUCT_VARIANT_CREATED,
        userId,
        undefined,
        undefined,
        { productId, variantId: variant.id, sku: variant.sku },
      );

      const fullVariant = await this.variantsRepository.findVariantById(variant.id);
      return ProductVariantEntity.fromPrisma(fullVariant!);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Duplicate variant option combination for this product.');
      }
      throw error;
    }
  }

  async addMedia(
    userId: string,
    productId: string,
    data: AddMediaData,
  ): Promise<ProductMediaEntity> {
    const { store } = await this.getAuthenticatedStore(userId);
    const product = await this.productsRepository.findById(productId);

    if (!product || product.storeId !== store.id) {
      throw new NotFoundException('Product not found in your store.');
    }

    const media = await this.variantsRepository.addMedia({
      product: { connect: { id: productId } },
      type: data.type || ProductMediaType.IMAGE,
      url: data.url.trim(),
      altText: data.altText?.trim() || null,
      sortOrder: data.sortOrder || 0,
      isPrimary: data.isPrimary || false,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.PRODUCT_MEDIA_ADDED,
      userId,
      undefined,
      undefined,
      { productId, mediaId: media.id },
    );

    return ProductMediaEntity.fromPrisma(media);
  }

  async deleteMedia(userId: string, productId: string, mediaId: string): Promise<void> {
    const { store } = await this.getAuthenticatedStore(userId);
    const product = await this.productsRepository.findById(productId);

    if (!product || product.storeId !== store.id) {
      throw new NotFoundException('Product not found in your store.');
    }

    await this.variantsRepository.deleteMedia(mediaId);

    await this.securityAuditService.logEvent(
      SecurityEventType.PRODUCT_MEDIA_DELETED,
      userId,
      undefined,
      undefined,
      { productId, mediaId },
    );
  }
}
