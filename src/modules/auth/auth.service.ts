import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { JwtPayload, RequestUser } from '../../common/interfaces/index.js';
import { hashPassword, verifyPassword } from '../../common/utils/index.js';
import { UserResponseDto } from '../users/dto/index.js';
import { UsersService } from '../users/index.js';
import {
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/index.js';
import { RefreshTokenRevokedReason } from './enums/index.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { AuthToken, TokenMetadata } from './types/index.js';

type RotationResult =
  | { status: 'ok'; refreshToken: string }
  | { status: 'invalid' }
  | { status: 'reused' }
  | { status: 'expired' };

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async register(
    registerDto: RegisterDto,
    metadata: TokenMetadata,
  ): Promise<AuthToken> {
    const passwordHash = await hashPassword(registerDto.password);

    const user = await this.usersService.create({
      email: registerDto.email,
      password: passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    const { token } = await this.refreshTokenService.issue(user.id, metadata);

    return this.createAuthToken(user, token);
  }

  async login(loginDto: LoginDto, metadata: TokenMetadata): Promise<AuthToken> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const userResponse = UserResponseDto.fromEntity(user);
    const { token } = await this.refreshTokenService.issue(user.id, metadata);

    return this.createAuthToken(userResponse, token);
  }

  async refresh(
    refreshTokenDto: RefreshTokenDto,
    metadata: TokenMetadata,
  ): Promise<AuthToken> {
    const payload = this.refreshTokenService.verify(
      refreshTokenDto.refreshToken,
    );
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rotation = await this.rotate(payload.jti, metadata);

    if (rotation.status === 'invalid') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (rotation.status === 'reused') {
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (rotation.status === 'expired') {
      throw new UnauthorizedException('Refresh token expired');
    }

    return this.createAuthToken(
      UserResponseDto.fromEntity(user),
      rotation.refreshToken,
    );
  }

  async logout(logoutDto: LogoutDto): Promise<void> {
    const { jti } = this.refreshTokenService.verify(logoutDto.refreshToken, {
      ignoreExpiration: true,
    });

    await this.refreshTokenService.revokeByJti(
      jti,
      RefreshTokenRevokedReason.Logout,
    );
  }

  async logoutAll(currentUser: RequestUser): Promise<void> {
    if (!currentUser?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    await this.refreshTokenService.revokeAllByUserId(
      currentUser.id,
      RefreshTokenRevokedReason.LogoutAll,
    );
  }

  async getMe(currentUser: RequestUser): Promise<UserResponseDto> {
    return this.usersService.findProfileById(currentUser?.id);
  }

  private async rotate(
    jti: string,
    metadata: TokenMetadata,
  ): Promise<RotationResult> {
    return this.refreshTokenService.runInTransaction(async (manager) => {
      const current = await this.refreshTokenService.findByJti(
        jti,
        manager,
        true,
      );

      if (!current) {
        return { status: 'invalid' };
      }

      if (current.revokedAt) {
        // Replaying a token that was already superseded by a rotation means the
        // token leaked, so every session of that user is dropped. Tokens revoked
        // by an explicit logout are not a compromise signal.
        if (current.revokedReason !== RefreshTokenRevokedReason.Rotated) {
          return { status: 'invalid' };
        }

        await this.refreshTokenService.revokeAllByUserId(
          current.userId,
          RefreshTokenRevokedReason.ReuseDetected,
          manager,
        );

        return { status: 'reused' };
      }

      if (current.expiresAt.getTime() <= Date.now()) {
        await this.refreshTokenService.revokeByJti(
          current.jti,
          RefreshTokenRevokedReason.Expired,
          null,
          manager,
        );

        return { status: 'expired' };
      }

      const { token, record } = await this.refreshTokenService.issue(
        current.userId,
        metadata,
        manager,
      );

      await this.refreshTokenService.revokeByJti(
        current.jti,
        RefreshTokenRevokedReason.Rotated,
        record.id,
        manager,
      );

      return { status: 'ok', refreshToken: token };
    });
  }

  private async createAuthToken(
    user: UserResponseDto,
    refreshToken: string,
  ): Promise<AuthToken> {
    const accessToken = await this.signAccessToken(user);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getExpiresIn(accessToken),
      user,
    };
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

  private getExpiresIn(token: string): number {
    const { iat, exp } = this.jwtService.decode<JwtPayload>(token);

    if (!iat || !exp) {
      return 0;
    }

    return exp - iat;
  }
}
