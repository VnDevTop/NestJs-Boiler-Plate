import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  DEVICE_NAME_HEADER,
  DEVICE_NAME_MAX_LENGTH,
} from '../../common/constants/index.js';
import {
  CurrentUser,
  DeviceName,
  Public,
} from '../../common/decorators/index.js';
import type { RequestUser } from '../../common/interfaces/index.js';
import { UserResponseDto } from '../users/dto/index.js';
import {
  AuthTokenResponseDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  UserDeviceDto,
} from './dto/index.js';
import { AuthService } from './auth.service.js';
import { AuthToken, DeviceMetadata } from './types/index.js';

const DEVICE_NAME_API_HEADER = {
  name: DEVICE_NAME_HEADER,
  required: false,
  description:
    'Friendly name for this device, shown in the device list. ' +
    'Derived from the user agent when omitted.',
  schema: { type: 'string', maxLength: DEVICE_NAME_MAX_LENGTH },
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiHeader(DEVICE_NAME_API_HEADER)
  register(
    @Body() registerDto: RegisterDto,
    @DeviceName() deviceName: string | null,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthToken> {
    return this.authService.register(
      registerDto,
      this.getMetadata(deviceName, ipAddress, userAgent),
    );
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiHeader(DEVICE_NAME_API_HEADER)
  login(
    @Body() loginDto: LoginDto,
    @DeviceName() deviceName: string | null,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthToken> {
    return this.authService.login(
      loginDto,
      this.getMetadata(deviceName, ipAddress, userAgent),
    );
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description:
      'Rotates the refresh token. The previous token is revoked and cannot be used again.',
  })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is invalid, expired, revoked or reused',
  })
  refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthToken> {
    return this.authService.refresh(
      refreshTokenDto,
      this.getMetadata(null, ipAddress, userAgent),
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the refresh token of the current session' })
  @ApiNoContentResponse({ description: 'Session revoked successfully' })
  logout(@Body() logoutDto: LogoutDto): Promise<void> {
    return this.authService.logout(logoutDto);
  }

  @Post('logout-all')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke every refresh token and deactivate every device',
  })
  @ApiNoContentResponse({ description: 'All sessions revoked successfully' })
  logoutAll(@CurrentUser() currentUser: RequestUser): Promise<void> {
    return this.authService.logoutAll(currentUser);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUser() currentUser: RequestUser): Promise<UserResponseDto> {
    return this.authService.getMe(currentUser);
  }

  @Get('devices')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the active devices of the current user' })
  @ApiOkResponse({ type: UserDeviceDto, isArray: true })
  devices(@CurrentUser() currentUser: RequestUser): Promise<UserDeviceDto[]> {
    return this.authService.listDevices(currentUser);
  }

  @Delete('devices/:id')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke a device and every refresh token attached to it',
  })
  @ApiNoContentResponse({ description: 'Device revoked successfully' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  revokeDevice(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') deviceId: string,
  ): Promise<void> {
    return this.authService.revokeDevice(currentUser, deviceId);
  }

  private getMetadata(
    deviceName: string | null,
    ipAddress: string,
    userAgent?: string,
  ): DeviceMetadata {
    return {
      deviceName,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    };
  }
}
