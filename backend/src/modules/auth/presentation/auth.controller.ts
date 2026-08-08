import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { AuthRateLimiterService } from '../infrastructure/auth-rate-limiter.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from '../domain/authenticated-user.interface';
import { AppRequest } from '../../../common/types/request-context.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: AuthRateLimiterService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @SwaggerResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  async register(@Body() dto: RegisterDto, @Req() req: AppRequest): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket.remoteAddress;
    await this.rateLimiter.checkRateLimit('register', ip || 'global');
    return this.authService.register(dto, ip, req.headers['user-agent']);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and issue tokens' })
  @SwaggerResponse({
    status: 200,
    description: 'User authenticated successfully',
    type: AuthResponseDto,
  })
  async login(@Body() dto: LoginDto, @Req() req: AppRequest): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket.remoteAddress;
    await this.rateLimiter.checkRateLimit('login', dto.identity);
    return this.authService.login(dto, ip, req.headers['user-agent']);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @SwaggerResponse({ status: 200, description: 'Tokens rotated successfully' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: AppRequest) {
    const ip = req.ip || req.socket.remoteAddress;
    await this.rateLimiter.checkRateLimit('refresh', ip || 'global');
    return this.authService.refresh(dto, ip, req.headers['user-agent']);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke current device session' })
  @SwaggerResponse({ status: 200, description: 'Session revoked successfully' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Req() req: AppRequest) {
    const ip = req.ip || req.socket.remoteAddress;
    await this.authService.logout(user.sessionId, user.id, ip, req.headers['user-agent']);
    return { message: 'Logged out successfully.' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all active sessions across all devices' })
  @SwaggerResponse({ status: 200, description: 'All user sessions revoked successfully' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Req() req: AppRequest) {
    const ip = req.ip || req.socket.remoteAddress;
    await this.authService.logoutAll(user.id, ip, req.headers['user-agent']);
    return { message: 'Logged out from all devices successfully.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve currently authenticated user profile' })
  @SwaggerResponse({ status: 200, description: 'Authenticated user profile' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  @SwaggerResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: AppRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    await this.authService.changePassword(user.id, dto, ip, req.headers['user-agent']);
    return {
      message: 'Password changed successfully. Please log in again with your new password.',
    };
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset token' })
  @SwaggerResponse({ status: 200, description: 'Generic confirmation message' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: AppRequest) {
    const ip = req.ip || req.socket.remoteAddress;
    await this.rateLimiter.checkRateLimit('reset-request', dto.identity);
    return this.authService.requestPasswordReset(dto, ip, req.headers['user-agent']);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  @SwaggerResponse({ status: 200, description: 'Password reset successful' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: AppRequest) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.authService.resetPassword(dto, ip, req.headers['user-agent']);
  }

  @Post('verify-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify account identity using token' })
  @SwaggerResponse({ status: 200, description: 'Verification successful' })
  async verifyAccount(@Body() dto: VerifyAccountDto, @Req() req: AppRequest) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.authService.verifyAccount(dto, ip, req.headers['user-agent']);
  }
}
