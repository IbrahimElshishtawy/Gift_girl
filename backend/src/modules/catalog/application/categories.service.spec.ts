import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from '../infrastructure/categories.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { CategoryStatus, SecurityEventType } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: jest.Mocked<CategoriesRepository>;
  let auditService: jest.Mocked<SecurityAuditService>;

  const mockCategory = {
    id: 'cat_dresses_123',
    name: 'Dresses',
    slug: 'dresses',
    description: 'Women dresses',
    imageUrl: null,
    parentId: null,
    status: CategoryStatus.ACTIVE,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    children: [],
  };

  beforeEach(async () => {
    const mockRepo = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findRootCategories: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      countProductsInCategory: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    };

    const mockAudit = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoriesRepository, useValue: mockRepo },
        { provide: SecurityAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    repo = module.get(CategoriesRepository);
    auditService = module.get(SecurityAuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCategoryAdmin', () => {
    it('should create category and log audit event', async () => {
      repo.findBySlug.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockCategory as any);

      const result = await service.createCategoryAdmin('admin_123', {
        name: 'Dresses',
      });

      expect(result.name).toBe('Dresses');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dresses', slug: 'dresses' }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        SecurityEventType.CATEGORY_CREATED,
        'admin_123',
        undefined,
        undefined,
        expect.objectContaining({ categoryId: 'cat_dresses_123' }),
      );
    });

    it('should throw ConflictException if slug already exists', async () => {
      repo.findBySlug.mockResolvedValue(mockCategory as any);

      await expect(
        service.createCategoryAdmin('admin_123', { name: 'Dresses', slug: 'dresses' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateCategoryAdmin', () => {
    it('should throw BadRequestException if category is assigned as its own parent', async () => {
      repo.findById.mockResolvedValue(mockCategory as any);

      await expect(
        service.updateCategoryAdmin('admin_123', 'cat_dresses_123', { parentId: 'cat_dresses_123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on circular parent relationship', async () => {
      const catA = { ...mockCategory, id: 'cat_a', parentId: null };
      const catB = { ...mockCategory, id: 'cat_b', parentId: 'cat_a' };

      repo.findById.mockImplementation((id: string) => {
        if (id === 'cat_a') return Promise.resolve(catA as any);
        if (id === 'cat_b') return Promise.resolve(catB as any);
        return Promise.resolve(null);
      });

      await expect(
        service.updateCategoryAdmin('admin_123', 'cat_a', { parentId: 'cat_b' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteCategoryAdmin', () => {
    it('should throw BadRequestException if parent category has children', async () => {
      const parentWithChild = { ...mockCategory, children: [mockCategory] };
      repo.findById.mockResolvedValue(parentWithChild as any);

      await expect(
        service.deleteCategoryAdmin('admin_123', 'cat_dresses_123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if category has products', async () => {
      repo.findById.mockResolvedValue(mockCategory as any);
      repo.countProductsInCategory.mockResolvedValue(5);

      await expect(
        service.deleteCategoryAdmin('admin_123', 'cat_dresses_123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
