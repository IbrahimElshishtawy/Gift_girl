import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoriesService } from '../application/categories.service';

@ApiTags('Public / Categories')
@Controller('categories')
export class PublicCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get active public category tree' })
  @ApiResponse({ status: 200, description: 'Hierarchical list of active categories.' })
  async getCategories() {
    return this.categoriesService.getPublicCategoryHierarchy();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get active public category details by slug' })
  @ApiResponse({ status: 200, description: 'Active category details.' })
  async getCategoryBySlug(@Param('slug') slug: string) {
    return this.categoriesService.getPublicCategoryBySlug(slug);
  }
}
