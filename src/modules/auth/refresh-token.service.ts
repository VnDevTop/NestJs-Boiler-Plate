import { randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import { RefreshTokenRevokedReason } from './enums/index.js';
import { RefreshToken } from './entities/index.js';
import { RefreshTokenPayload, TokenMetadata } from './types/index.js';

export interface IssuedRefreshToken {
  token: string;
  record: RefreshToken;
}

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private get store(): EntityManager {
    return this.refreshTokensRepository.manager;
  }

  private get jwtOptions(): JwtModuleOptions {
    return this.configService.getOrThrow<JwtModuleOptions>('jwtRefreshToken');
  }

  private get secret(): string | Buffer {
    const { secret } = this.jwtOptions;

    if (typeof secret === 'string' || Buffer.isBuffer(secret)) {
      return secret;
    }

    throw new Error('JWT refresh token secret is not configured');
  }

  async runInTransaction<T>(
    handler: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(handler);
  }

  async issue(
    userId: string,
    metadata: TokenMetadata,
    deviceId: string | null = null,
    manager: EntityManager = this.store,
  ): Promise<IssuedRefreshToken> {
    const jti = randomUUID();

    const token = await this.jwtService.signAsync(
      { sub: userId, jti } satisfies RefreshTokenPayload,
      {
        ...this.jwtOptions.signOptions,
        secret: this.secret,
      },
    );

    const { exp } = this.jwtService.decode<RefreshTokenPayload>(token);

    const record = manager.create(RefreshToken, {
      userId,
      jti,
      expiresAt: new Date((exp ?? 0) * 1000),
      revokedAt: null,
      revokedReason: null,
      replacedById: null,
      deviceId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return { token, record: await manager.save(record) };
  }

  verify(
    token: string,
    options: { ignoreExpiration?: boolean } = {},
  ): RefreshTokenPayload {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: this.secret,
        ignoreExpiration: options.ignoreExpiration ?? false,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  findByJti(
    jti: string,
    manager: EntityManager = this.store,
    lock = false,
  ): Promise<RefreshToken | null> {
    return manager.findOne(RefreshToken, {
      where: { jti },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
  }

  async revokeByJti(
    jti: string,
    reason: RefreshTokenRevokedReason,
    replacedById: string | null = null,
    manager: EntityManager = this.store,
  ): Promise<void> {
    await manager.update(
      RefreshToken,
      { jti, revokedAt: IsNull() },
      {
        revokedAt: new Date(),
        revokedReason: reason,
        replacedById,
      },
    );
  }

  async revokeAllByDeviceId(
    deviceId: string,
    reason: RefreshTokenRevokedReason,
    manager: EntityManager = this.store,
  ): Promise<number> {
    const result = await manager.update(
      RefreshToken,
      { deviceId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );

    return result.affected ?? 0;
  }

  async revokeAllByUserId(
    userId: string,
    reason: RefreshTokenRevokedReason,
    manager: EntityManager = this.store,
  ): Promise<number> {
    const result = await manager.update(
      RefreshToken,
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );

    return result.affected ?? 0;
  }
}
