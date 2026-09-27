import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser, Public } from '../../common/decorators/index.js';
import type { RequestUser } from '../../common/interfaces/index.js';
import { UserResponseDto } from '../users/dto/index.js';
import {
  AuthTokenResponseDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/index.js';
import { AuthService } from './auth.service.js';
import { AuthToken, TokenMetadata } from './types/index.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  register(
    @Body() registerDto: RegisterDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthToken> {
    return this.authService.register(
      registerDto,
      this.getMetadata(ipAddress, userAgent),
    );
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthToken> {
    return this.authService.login(
      loginDto,
      this.getMetadata(ipAddress, userAgent),
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
      this.getMetadata(ipAddress, userAgent),
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
  @ApiOperation({ summary: 'Revoke every refresh token of the current user' })
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

  private getMetadata(ipAddress: string, userAgent?: string): TokenMetadata {
    return {
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    };
  }
}
