import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/domain/authenticated-user.interface';
import { SellersService } from '../application/sellers.service';
import { AddSellerStaffDto } from './dto/add-seller-staff.dto';
import { SellerStaffStatus } from '@prisma/client';
import { AppRequest } from '../../../common/types/request-context.interface';

@ApiTags('Seller Staff Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sellers/me/staff')
export class SellerStaffController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @ApiOperation({ summary: 'List staff members for authenticated seller' })
  async getStaff(@CurrentUser() user: AuthenticatedUser) {
    return this.sellersService.getStaffForSeller(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a user as a staff member to seller team' })
  @ApiResponse({ status: 201, description: 'Staff member added successfully' })
  async addStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddSellerStaffDto,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.sellersService.addStaffMember(
      user.id,
      dto.targetUserId,
      dto.role,
      ip,
      ua,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update staff member status (ACTIVE, SUSPENDED)' })
  async updateStaffStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() body: { status: SellerStaffStatus },
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.sellersService.updateStaffStatus(
      user.id,
      staffId,
      body.status,
      ip,
      ua,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove staff member from seller team' })
  async removeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    await this.sellersService.removeStaffMember(user.id, staffId, ip, ua);
  }
}
