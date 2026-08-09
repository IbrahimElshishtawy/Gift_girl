import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { BrandsRepository } from '../infrastructure/brands.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { BrandEntity } from '../domain/brand.entity';
import { BrandStatus, SecurityEventType, Prisma } from '@prisma/client';

export interface CreateBrandData {
  name: string;
  slug?: string;
  logoUrl?: string;
  description?: string;
}

export interface UpdateBrandData {
  name?: string;
  logoUrl?: string;
  description?: string;
  status?: BrandStatus;
}

@Injectable()
export class BrandsService {
  constructor(
    private readonly brandsRepository: BrandsRepository,
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

  async listBrandsAdmin(params: {
    page?: number;
    limit?: number;
    status?: BrandStatus;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BrandWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ];
    }

    const { items, total } = await this.brandsRepository.findMany({
      skip,
      take: limit,
      where,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(BrandEntity.fromPrisma),
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

  async getBrandById(id: string): Promise<BrandEntity> {
    const brand = await this.brandsRepository.findById(id);
    if (!brand) throw new NotFoundException('Brand not found.');
    return BrandEntity.fromPrisma(brand);
  }

  async createBrandAdmin(
    adminUserId: string,
    data: CreateBrandData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BrandEntity> {
    const slug = data.slug ? this.slugify(data.slug) : this.slugify(data.name);

    const existingSlug = await this.brandsRepository.findBySlug(slug);
    if (existingSlug) {
      throw new ConflictException(`Brand slug '${slug}' is already in use.`);
    }

    const brand = await this.brandsRepository.create({
      name: data.name.trim(),
      slug,
      logoUrl: data.logoUrl?.trim() || null,
      description: data.description?.trim() || null,
      status: BrandStatus.ACTIVE,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.BRAND_CREATED,
      adminUserId,
      ipAddress,
      userAgent,
      { brandId: brand.id, name: brand.name, slug: brand.slug },
    );

    return BrandEntity.fromPrisma(brand);
  }

  async updateBrandAdmin(
    adminUserId: string,
    id: string,
    data: UpdateBrandData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BrandEntity> {
    const brand = await this.brandsRepository.findById(id);
    if (!brand) throw new NotFoundException('Brand not found.');

    const updated = await this.brandsRepository.update(id, {
      name: data.name?.trim(),
      logoUrl: data.logoUrl !== undefined ? data.logoUrl.trim() || null : undefined,
      description: data.description !== undefined ? data.description.trim() || null : undefined,
      status: data.status,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.BRAND_UPDATED,
      adminUserId,
      ipAddress,
      userAgent,
      { brandId: id, updatedFields: Object.keys(data) },
    );

    return BrandEntity.fromPrisma(updated);
  }
}
