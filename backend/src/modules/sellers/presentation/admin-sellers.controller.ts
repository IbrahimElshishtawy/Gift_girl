import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { Permissions } from '../../auth/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/domain/authenticated-user.interface';
import { UserRole, SellerStatus, SellerDocumentStatus } from '@prisma/client';
import { SellerOnboardingService } from '../application/seller-onboarding.service';
import { SellersService } from '../application/sellers.service';
import { AdminSellerQueryDto } from './dto/admin-seller-query.dto';
import { AdminUpdateSellerStatusDto } from './dto/admin-update-seller-status.dto';
import { AppRequest } from '../../../common/types/request-context.interface';

@ApiTags('Admin Seller Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/sellers')
export class AdminSellersController {
  constructor(
    private readonly onboardingService: SellerOnboardingService,
    private readonly sellersService: SellersService,
  ) {}

  @Get()
  @Permissions('sellers.read')
  @ApiOperation({ summary: 'Paginated, searched, and filtered list of sellers' })
  async listSellers(@Query() query: AdminSellerQueryDto) {
    return this.sellersService.listSellersAdmin(query);
  }

  @Get(':id')
  @Permissions('sellers.read')
  @ApiOperation({ summary: 'Get detailed seller profile by ID' })
  async getSellerById(@Param('id') sellerId: string) {
    return this.sellersService.getSellerById(sellerId);
  }

  @Post(':id/approve')
  @Permissions('sellers.approve')
  @ApiOperation({ summary: 'Approve seller application (Atomic Seller creation + RBAC role sync)' })
  async approveSeller(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') applicationId: string,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.onboardingService.approveApplication(adminUser.id, applicationId, ip, ua);
  }

  @Post(':id/reject')
  @Permissions('sellers.reject')
  @ApiOperation({ summary: 'Reject seller onboarding application' })
  async rejectSeller(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') applicationId: string,
    @Body() body: { reason: string },
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.onboardingService.rejectApplication(
      adminUser.id,
      applicationId,
      body.reason,
      ip,
      ua,
    );
  }

  @Post(':id/suspend')
  @Permissions('sellers.suspend')
  @ApiOperation({ summary: 'Suspend active seller account' })
  async suspendSeller(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') sellerId: string,
    @Body() body: { reason?: string },
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.sellersService.updateSellerStatus(
      adminUser.id,
      sellerId,
      SellerStatus.SUSPENDED,
      body?.reason,
      ip,
      ua,
    );
  }

  @Post(':id/activate')
  @Permissions('sellers.activate')
  @ApiOperation({ summary: 'Activate suspended/pending seller account' })
  async activateSeller(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') sellerId: string,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.sellersService.updateSellerStatus(
      adminUser.id,
      sellerId,
      SellerStatus.ACTIVE,
      'Activated by administrator',
      ip,
      ua,
    );
  }

  @Post(':id/disable')
  @Permissions('sellers.suspend')
  @ApiOperation({ summary: 'Disable seller account' })
  async disableSeller(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('id') sellerId: string,
    @Body() body: { reason?: string },
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.sellersService.updateSellerStatus(
      adminUser.id,
      sellerId,
      SellerStatus.DISABLED,
      body?.reason,
      ip,
      ua,
    );
  }

  @Get(':id/documents')
  @Permissions('seller_documents.read')
  @ApiOperation({ summary: 'List verification documents for seller' })
  async getSellerDocuments(@Param('id') sellerId: string) {
    return this.onboardingService.getSellerDocuments(sellerId);
  }

  @Post(':id/documents/:documentId/approve')
  @Permissions('seller_documents.review')
  @ApiOperation({ summary: 'Approve seller verification document' })
  async approveDocument(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.onboardingService.reviewDocument(
      adminUser.id,
      documentId,
      SellerDocumentStatus.VERIFIED,
      undefined,
      ip,
      ua,
    );
  }

  @Post(':id/documents/:documentId/reject')
  @Permissions('seller_documents.review')
  @ApiOperation({ summary: 'Reject seller verification document' })
  async rejectDocument(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() body: { reason: string },
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.onboardingService.reviewDocument(
      adminUser.id,
      documentId,
      SellerDocumentStatus.REJECTED,
      body.reason,
      ip,
      ua,
    );
  }
}
