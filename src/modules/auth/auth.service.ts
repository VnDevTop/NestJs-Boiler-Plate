import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { JwtPayload, RequestUser } from '../../common/interfaces/index.js';
import { hashPassword, verifyPassword } from '../../common/utils/index.js';
import { UserResponseDto } from '../users/dto/index.js';
import { UsersService } from '../users/index.js';
import { LoginDto, RegisterDto } from './dto/index.js';
import { AuthToken } from './types/index.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}
  
  async register(registerDto: RegisterDto): Promise<AuthToken> {
    const passwordHash = await hashPassword(registerDto.password);
    
    const user = await this.usersService.create({
      email: registerDto.email,
      password: passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });
    
    const accessToken = await this.signAccessToken(user);
    
    return {
      accessToken,
      tokenType: 'Bearer',
      user,
    };
  }
  
  async login(loginDto: LoginDto): Promise<AuthToken> {
    const user = await this.usersService.findByEmail(loginDto.email);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    
    const isPasswordValid = await verifyPassword(loginDto.password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    
    const userResponse = UserResponseDto.fromEntity(user);
    const accessToken = await this.signAccessToken(userResponse);
    
    return {
      accessToken,
      tokenType: 'Bearer',
      user: userResponse,
    };
  }
  
  async getMe(currentUser: RequestUser): Promise<UserResponseDto> {
    return this.usersService.findProfileById(currentUser?.id);
  }
  
  private async signAccessToken(user: UserResponseDto): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isManager: user.isManager,
    };
    
    return this.jwtService.signAsync(payload);
  }
}