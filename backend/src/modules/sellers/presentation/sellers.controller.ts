import { Controller, Get, Post, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/domain/authenticated-user.interface';
import { SellerOnboardingService } from '../application/seller-onboarding.service';
import { SellersService } from '../application/sellers.service';
import { ApplySellerDto } from './dto/apply-seller.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('Seller Onboarding & Profile')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sellers')
export class SellersController {
  constructor(
    private readonly onboardingService: SellerOnboardingService,
    private readonly sellersService: SellersService,
  ) {}

  @Post('apply')
  @ApiOperation({ summary: 'Submit a new seller onboarding application' })
  @ApiResponse({ status: 201, description: 'Application submitted successfully' })
  async applyForSeller(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplySellerDto) {
    return this.onboardingService.applyForSeller(user.id, dto);
  }

  @Get('me/application')
  @ApiOperation({ summary: 'Get current user seller onboarding application' })
  async getMyApplication(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getMyApplication(user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated seller profile' })
  async getMySellerProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.sellersService.getSellerByUserId(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update seller profile details' })
  async updateMySellerProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSellerProfileDto,
  ) {
    return this.sellersService.updateSellerProfile(user.id, dto);
  }

  @Get('me/documents')
  @ApiOperation({ summary: 'List verification documents for authenticated seller' })
  async getMyDocuments(@CurrentUser() user: AuthenticatedUser) {
    const seller = await this.sellersService.getSellerByUserId(user.id);
    return this.onboardingService.getSellerDocuments(seller.id);
  }

  @Post('me/documents')
  @ApiOperation({ summary: 'Upload verification document for seller onboarding' })
  @ApiResponse({ status: 201, description: 'Document record created successfully' })
  async uploadDocument(@CurrentUser() user: AuthenticatedUser, @Body() dto: UploadDocumentDto) {
    return this.onboardingService.uploadDocument(user.id, dto);
  }
}
