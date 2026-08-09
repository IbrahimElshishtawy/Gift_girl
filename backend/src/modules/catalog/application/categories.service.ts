import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CategoriesRepository } from '../infrastructure/categories.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { CategoryEntity } from '../domain/category.entity';
import { CategoryStatus, SecurityEventType, Prisma } from '@prisma/client';

export interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  sortOrder?: number;
  status?: CategoryStatus;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
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

  async getPublicCategoryHierarchy(): Promise<CategoryEntity[]> {
    const rootCategories = await this.categoriesRepository.findRootCategories(true);
    return rootCategories.map(CategoryEntity.fromPrisma);
  }

  async getPublicCategoryBySlug(slug: string): Promise<CategoryEntity> {
    const category = await this.categoriesRepository.findBySlug(slug);
    if (!category || category.status !== CategoryStatus.ACTIVE) {
      throw new NotFoundException(`Category with slug '${slug}' not found.`);
    }
    return CategoryEntity.fromPrisma(category);
  }

  async listCategoriesAdmin(params: {
    page?: number;
    limit?: number;
    status?: CategoryStatus;
    parentId?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.parentId !== undefined) {
      where.parentId = params.parentId === 'null' ? null : params.parentId;
    }

    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ];
    }

    const { items, total } = await this.categoriesRepository.findMany({
      skip,
      take: limit,
      where,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(CategoryEntity.fromPrisma),
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

  async getCategoryByIdAdmin(id: string): Promise<CategoryEntity> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found.');
    return CategoryEntity.fromPrisma(category);
  }

  async createCategoryAdmin(
    adminUserId: string,
    data: CreateCategoryData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CategoryEntity> {
    const slug = data.slug ? this.slugify(data.slug) : this.slugify(data.name);

    const existingSlug = await this.categoriesRepository.findBySlug(slug);
    if (existingSlug) {
      throw new ConflictException(`Category slug '${slug}' is already in use.`);
    }

    if (data.parentId) {
      const parent = await this.categoriesRepository.findById(data.parentId);
      if (!parent) throw new NotFoundException('Parent category not found.');
    }

    const category = await this.categoriesRepository.create({
      name: data.name.trim(),
      slug,
      description: data.description?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
      status: CategoryStatus.ACTIVE,
      sortOrder: data.sortOrder || 0,
      parent: data.parentId ? { connect: { id: data.parentId } } : undefined,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.CATEGORY_CREATED,
      adminUserId,
      ipAddress,
      userAgent,
      { categoryId: category.id, name: category.name, slug: category.slug },
    );

    return CategoryEntity.fromPrisma(category);
  }

  async updateCategoryAdmin(
    adminUserId: string,
    id: string,
    data: UpdateCategoryData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CategoryEntity> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found.');

    if (data.parentId && data.parentId === id) {
      throw new BadRequestException('A category cannot be its own parent.');
    }

    if (data.parentId) {
      const parent = await this.categoriesRepository.findById(data.parentId);
      if (!parent) throw new NotFoundException('Parent category not found.');

      // Circular dependency check
      let currentParentId: string | null = parent.parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          throw new BadRequestException('Circular parent relationship detected.');
        }
        const p = await this.categoriesRepository.findById(currentParentId);
        currentParentId = p ? p.parentId : null;
      }
    }

    const updated = await this.categoriesRepository.update(id, {
      name: data.name?.trim(),
      description: data.description !== undefined ? data.description.trim() || null : undefined,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl.trim() || null : undefined,
      sortOrder: data.sortOrder,
      status: data.status,
      parent: data.parentId !== undefined
        ? data.parentId ? { connect: { id: data.parentId } } : { disconnect: true }
        : undefined,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.CATEGORY_UPDATED,
      adminUserId,
      ipAddress,
      userAgent,
      { categoryId: id, updatedFields: Object.keys(data) },
    );

    return CategoryEntity.fromPrisma(updated);
  }

  async updateCategoryStatusAdmin(
    adminUserId: string,
    id: string,
    status: CategoryStatus,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CategoryEntity> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found.');

    const updated = await this.categoriesRepository.updateStatus(id, status);

    const event = status === CategoryStatus.ACTIVE
      ? SecurityEventType.CATEGORY_ACTIVATED
      : SecurityEventType.CATEGORY_DEACTIVATED;

    await this.securityAuditService.logEvent(event, adminUserId, ipAddress, userAgent, {
      categoryId: id,
      newStatus: status,
    });

    return CategoryEntity.fromPrisma(updated);
  }

  async deleteCategoryAdmin(
    adminUserId: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found.');

    if (category.children && category.children.length > 0) {
      throw new BadRequestException('Cannot delete a parent category that has subcategories.');
    }

    const productCount = await this.categoriesRepository.countProductsInCategory(id);
    if (productCount > 0) {
      throw new BadRequestException(`Cannot delete category with ${productCount} assigned products.`);
    }

    await this.categoriesRepository.delete(id);

    await this.securityAuditService.logEvent(
      SecurityEventType.CATEGORY_DELETED,
      adminUserId,
      ipAddress,
      userAgent,
      { categoryId: id, name: category.name },
    );
  }
}
