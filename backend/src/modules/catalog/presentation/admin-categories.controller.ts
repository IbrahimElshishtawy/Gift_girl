import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { CategoriesService } from '../application/categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AdminCategoryQueryDto } from './dto/admin-category-query.dto';
import { CategoryStatus } from '@prisma/client';

import { AppRequest } from '../../../common/types/request-context.interface';

type AuthenticatedRequest = AppRequest & { user: { id: string } };

@ApiTags('Admin / Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Permissions('categories.read')
  @ApiOperation({ summary: 'Paginated admin list of categories' })
  @ApiResponse({ status: 200, description: 'Paginated list of categories.' })
  async listCategories(@Query() query: AdminCategoryQueryDto) {
    return this.categoriesService.listCategoriesAdmin(query);
  }

  @Get(':id')
  @Permissions('categories.read')
  @ApiOperation({ summary: 'Get category details by ID' })
  @ApiResponse({ status: 200, description: 'Category details.' })
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.getCategoryByIdAdmin(id);
  }

  @Post()
  @Permissions('categories.create')
  @ApiOperation({ summary: 'Create new category' })
  @ApiResponse({ status: 201, description: 'Category created successfully.' })
  async createCategory(@Req() req: AuthenticatedRequest, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategoryAdmin(
      req.user.id,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch(':id')
  @Permissions('categories.update')
  @ApiOperation({ summary: 'Update category details' })
  @ApiResponse({ status: 200, description: 'Category updated successfully.' })
  async updateCategory(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategoryAdmin(
      req.user.id,
      id,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':id/activate')
  @Permissions('categories.update')
  @ApiOperation({ summary: 'Activate category' })
  @ApiResponse({ status: 200, description: 'Category activated.' })
  async activateCategory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.categoriesService.updateCategoryStatusAdmin(
      req.user.id,
      id,
      CategoryStatus.ACTIVE,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':id/deactivate')
  @Permissions('categories.update')
  @ApiOperation({ summary: 'Deactivate category' })
  @ApiResponse({ status: 200, description: 'Category deactivated.' })
  async deactivateCategory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.categoriesService.updateCategoryStatusAdmin(
      req.user.id,
      id,
      CategoryStatus.INACTIVE,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('categories.delete')
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 24, description: 'Category deleted successfully.' })
  async deleteCategory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.categoriesService.deleteCategoryAdmin(
      req.user.id,
      id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
