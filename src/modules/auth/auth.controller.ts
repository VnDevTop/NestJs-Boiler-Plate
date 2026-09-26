import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, Public } from '../../common/decorators/index.js';
import type { RequestUser } from '../../common/interfaces/index.js';
import { UserResponseDto } from '../users/dto/index.js';
import { AuthTokenResponseDto, LoginDto, RegisterDto } from './dto/index.js';
import { AuthService } from './auth.service.js';
import { AuthToken } from './types/index.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  register(@Body() registerDto: RegisterDto): Promise<AuthToken> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  login(@Body() loginDto: LoginDto): Promise<AuthToken> {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUser() currentUser: RequestUser): Promise<UserResponseDto> {
    return this.authService.getMe(currentUser);
  }
}
