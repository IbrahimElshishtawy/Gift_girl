import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/domain/authenticated-user.interface';
import { UserProfileService } from '../application/user-profile.service';
import { UserAddressService } from '../application/user-address.service';
import { UsersService } from '../application/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { AppRequest } from '../../../common/types/request-context.interface';

@ApiTags('User Profile & Account')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UsersMeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly profileService: UserProfileService,
    private readonly addressService: UserAddressService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get current authenticated user identity profile, addresses, and preferences',
  })
  @ApiResponse({ status: 200, description: 'Safe profile details returned successfully' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    const userIdentity = await this.usersService.findById(user.id);
    const profile = await this.profileService.getProfile(user.id);
    const preferences = await this.profileService.getPreferences(user.id);
    const addresses = await this.addressService.getUserAddresses(user.id);

    return {
      id: userIdentity?.id,
      email: userIdentity?.email,
      phone: userIdentity?.phone,
      role: userIdentity?.role,
      status: userIdentity?.status,
      emailVerified: userIdentity?.emailVerified,
      phoneVerified: userIdentity?.phoneVerified,
      profile,
      preferences,
      addresses,
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update authenticated user profile details' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined;

    return this.profileService.updateProfile(
      user.id,
      {
        ...dto,
        dateOfBirth,
      },
      ip,
      ua,
    );
  }

  @Get('addresses')
  @ApiOperation({ summary: 'List addresses for authenticated user' })
  async getMyAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.addressService.getUserAddresses(user.id);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Add a new shipping address' })
  async createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.addressService.createAddress(user.id, dto, ip, ua);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Update address details (ownership protected)' })
  async updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.addressService.updateAddress(addressId, user.id, dto, ip, ua);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete shipping address (ownership protected)' })
  async deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') addressId: string,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    await this.addressService.deleteAddress(addressId, user.id, ip, ua);
  }

  @Post('addresses/:id/default')
  @ApiOperation({ summary: 'Set default shipping address (transactional switch)' })
  async setDefaultAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') addressId: string,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.addressService.setDefaultAddress(addressId, user.id, ip, ua);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  async getMyPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  async updateMyPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.profileService.updatePreferences(user.id, dto);
  }
}
