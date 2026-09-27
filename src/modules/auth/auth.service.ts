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
  TwoFactorCodeDto,
  TwoFactorEnabledResponseDto,
  TwoFactorLoginDto,
  UserDeviceDto,
} from './dto/index.js';
import { RefreshTokenRevokedReason } from './enums/index.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { DeviceService } from './device.service.js';
import { TwoFactorService } from './two-factor.service.js';
import {
  AuthToken,
  DeviceMetadata,
  TokenMetadata,
  TwoFactorChallenge,
  TwoFactorSetup,
} from './types/index.js';

type RotationResult =
  | { status: 'ok'; refreshToken: string }
  | { status: 'invalid' }
  | { status: 'reused' }
  | { status: 'expired' };

export type LoginResult = AuthToken | TwoFactorChallenge;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly deviceService: DeviceService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async register(
    registerDto: RegisterDto,
    metadata: DeviceMetadata,
  ): Promise<AuthToken> {
    const passwordHash = await hashPassword(registerDto.password);

    const user = await this.usersService.create({
      email: registerDto.email,
      password: passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    const { token } = await this.issueSession(user.id, metadata);

    return this.createAuthToken(user, token);
  }

  /**
   * Password check only. When the account has 2FA enabled no tokens are issued
   * here, the caller receives a short lived challenge instead and has to prove
   * the second factor on the two-factor login route.
   */
  async login(
    loginDto: LoginDto,
    metadata: DeviceMetadata,
  ): Promise<LoginResult> {
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

    if (await this.twoFactorService.isEnabled(user.id)) {
      return this.twoFactorService.issueChallenge(user.id);
    }

    const { token } = await this.issueSession(user.id, metadata);

    return this.createAuthToken(userResponse, token);
  }

  /**
   * Completes a login that was interrupted by the second factor check.
   */
  async twoFactorLogin(
    twoFactorLoginDto: TwoFactorLoginDto,
    metadata: DeviceMetadata,
  ): Promise<AuthToken> {
    const userId = this.twoFactorService.verifyChallengeToken(
      twoFactorLoginDto.challengeToken,
    );
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid two-factor challenge');
    }

    await this.twoFactorService.verifyChallenge(userId, twoFactorLoginDto.code);

    const { token } = await this.issueSession(user.id, metadata);

    return this.createAuthToken(UserResponseDto.fromEntity(user), token);
  }

  twoFactorSetup(currentUser: RequestUser): Promise<TwoFactorSetup> {
    return this.twoFactorService.setup(currentUser.id, currentUser.email);
  }

  twoFactorVerify(
    currentUser: RequestUser,
    twoFactorCodeDto: TwoFactorCodeDto,
  ): Promise<TwoFactorEnabledResponseDto> {
    return this.twoFactorService
      .verifySetup(currentUser.id, twoFactorCodeDto.code)
      .then(({ recoveryCodes }) => ({ enabled: true as const, recoveryCodes }));
  }

  async twoFactorDisable(
    currentUser: RequestUser,
    twoFactorCodeDto: TwoFactorCodeDto,
  ): Promise<void> {
    await this.twoFactorService.disable(currentUser.id, twoFactorCodeDto.code);
  }

  async refresh(
    refreshTokenDto: RefreshTokenDto,
    metadata: DeviceMetadata,
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

    await this.refreshTokenService.runInTransaction(async (manager) => {
      await this.refreshTokenService.revokeAllByUserId(
        currentUser.id,
        RefreshTokenRevokedReason.LogoutAll,
        manager,
      );

      await this.deviceService.revokeAllByUserId(currentUser.id);
    });
  }

  async getMe(currentUser: RequestUser): Promise<UserResponseDto> {
    return this.usersService.findProfileById(currentUser?.id);
  }

  listDevices(currentUser: RequestUser): Promise<UserDeviceDto[]> {
    return this.deviceService.listByUserId(currentUser.id);
  }

  async revokeDevice(
    currentUser: RequestUser,
    deviceId: string,
  ): Promise<void> {
    if (!currentUser?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const device = await this.deviceService.revoke(currentUser.id, deviceId);

    await this.refreshTokenService.revokeAllByDeviceId(
      device.id,
      RefreshTokenRevokedReason.DeviceRevoked,
    );
  }

  private async issueSession(
    userId: string,
    metadata: DeviceMetadata,
  ): Promise<{ token: string }> {
    const device = await this.deviceService.register(userId, metadata);
    const tokenMetadata = this.toTokenMetadata(metadata);

    return this.refreshTokenService.issue(userId, tokenMetadata, device.id);
  }

  private async rotate(
    jti: string,
    metadata: DeviceMetadata,
  ): Promise<RotationResult> {
    const tokenMetadata = this.toTokenMetadata(metadata);

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
        await this.deviceService.revokeAllByUserId(current.userId);

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

      // The rotated token stays on the same device, so a session never hops
      // between devices on refresh.
      const { token, record } = await this.refreshTokenService.issue(
        current.userId,
        tokenMetadata,
        current.deviceId,
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

  private toTokenMetadata(metadata: DeviceMetadata): TokenMetadata {
    return {
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    };
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
