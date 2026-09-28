import { Throttle } from '@nestjs/throttler';
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
  ApiExtraModels,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
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
  TwoFactorChallengeResponseDto,
  TwoFactorCodeDto,
  TwoFactorEnabledResponseDto,
  TwoFactorLoginDto,
  TwoFactorSetupResponseDto,
  UserDeviceDto,
} from './dto/index.js';
import { AuthService, LoginResult } from './auth.service.js';
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

  // Registration is cheap to call and creates rows, so it gets its own
  // tighter budget than the global one.
  @Throttle({ default: { limit: 10, ttl: 300000 } })
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

  // Password guessing is the reason this route exists, so it is the
  // tightest limit in the app.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiExtraModels(AuthTokenResponseDto, TwoFactorChallengeResponseDto)
  @ApiOkResponse({
    description:
      'Token pair, or a two-factor challenge when the account requires 2FA',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthTokenResponseDto) },
        { $ref: getSchemaPath(TwoFactorChallengeResponseDto) },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiHeader(DEVICE_NAME_API_HEADER)
  login(
    @Body() loginDto: LoginDto,
    @DeviceName() deviceName: string | null,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LoginResult> {
    return this.authService.login(
      loginDto,
      this.getMetadata(deviceName, ipAddress, userAgent),
    );
  }

  // A six digit code has a million combinations, so it must not be
  // brute forceable.
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Public()
  @Post('2fa/login')
  @ApiOperation({
    summary: 'Complete a login that requires a second factor',
    description:
      'Exchanges a challenge token and a second factor for a token pair.',
  })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid challenge or code' })
  @ApiHeader(DEVICE_NAME_API_HEADER)
  twoFactorLogin(
    @Body() twoFactorLoginDto: TwoFactorLoginDto,
    @DeviceName() deviceName: string | null,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthToken> {
    return this.authService.twoFactorLogin(
      twoFactorLoginDto,
      this.getMetadata(deviceName, ipAddress, userAgent),
    );
  }

  @Post('2fa/setup')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generate a two-factor secret',
    description:
      'Returns a secret, an otpauth URI and a QR code. Two-factor is not active until the setup is verified.',
  })
  @ApiOkResponse({ type: TwoFactorSetupResponseDto })
  twoFactorSetup(
    @CurrentUser() currentUser: RequestUser,
  ): Promise<TwoFactorSetupResponseDto> {
    return this.authService.twoFactorSetup(currentUser);
  }

  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('2fa/verify')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Activate two-factor authentication',
    description:
      'Confirms the pending secret and returns single use recovery codes.',
  })
  @ApiOkResponse({ type: TwoFactorEnabledResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid verification code' })
  twoFactorVerify(
    @CurrentUser() currentUser: RequestUser,
    @Body() twoFactorCodeDto: TwoFactorCodeDto,
  ): Promise<TwoFactorEnabledResponseDto> {
    return this.authService.twoFactorVerify(currentUser, twoFactorCodeDto);
  }

  @Post('2fa/disable')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Disable two-factor authentication',
    description: 'Requires a valid code or a recovery code.',
  })
  @ApiNoContentResponse({ description: 'Two-factor authentication disabled' })
  @ApiUnauthorizedResponse({ description: 'Invalid verification code' })
  twoFactorDisable(
    @CurrentUser() currentUser: RequestUser,
    @Body() twoFactorCodeDto: TwoFactorCodeDto,
  ): Promise<void> {
    return this.authService.twoFactorDisable(currentUser, twoFactorCodeDto);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
