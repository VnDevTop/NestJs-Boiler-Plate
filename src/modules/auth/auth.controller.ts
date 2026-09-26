import { Body, Controller, Get, Post } from '@nestjs/common';

import { CurrentUser, Public } from '../../common/decorators/index.js';
import type { RequestUser } from '../../common/interfaces/index.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto } from './dto/index.js';
import { AuthToken } from './types/index.js';
import { UserResponseDto } from '../users/dto/index.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto): Promise<AuthToken> {
    return this.authService.register(registerDto);
  }
  
  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto): Promise<AuthToken> {
    return this.authService.login(loginDto);
  }
  
  @Get('me')
  me(@CurrentUser() currentUser: RequestUser): Promise<UserResponseDto> {
    return this.authService.getMe(currentUser);
  }
}