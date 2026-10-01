import { randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  Repository,
} from 'typeorm';

import { EMAIL_VERIFICATION_TOKEN_TTL_HOURS } from '../../common/constants/index.js';
import { hashToken } from '../../common/utils/index.js';
import { User } from '../users/entities/index.js';
import { EmailVerificationToken } from './entities/index.js';

const logger = new Logger('EmailVerificationService');

export interface IssuedVerification {
  /** Plaintext, sent once in the email and never stored. */
  token: string;
  expiresAt: Date;
}

/**
 * Issues, resends and consumes email verification tokens.
 *
 * The same shape as the password reset flow on purpose: a token is spent by
 * writing to a row, so confirming an address and marking the token used can
 * happen in one transaction and a crash cannot confirm twice.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly verificationRepository: Repository<EmailVerificationToken>,
    private readonly dataSource: DataSource,
  ) {}

  private get store(): EntityManager {
    return this.verificationRepository.manager;
  }

  private get ttlMs(): number {
    return EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000;
  }

  /**
   * Mints a token for an address and spends the outstanding ones.
   *
   * Spent rather than deleted, so a link that was already in an inbox stops
   * working the moment a newer one is sent, and so the row count stays
   * auditable until retention removes it.
   */
  async issue(
    user: User,
    email: string,
    ipAddress: string | null,
  ): Promise<IssuedVerification> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);

    await this.spendOutstandingFor(user.id);

    await this.store.save(
      this.store.create(EmailVerificationToken, {
        userId: user.id,
        tokenHash: hashToken(token),
        email,
        expiresAt,
        usedAt: null,
        ipAddress,
      }),
    );

    return { token, expiresAt };
  }

  /**
   * Confirms an address and marks the token spent, in one transaction.
   *
   * Refuses when the address has changed since the token was minted: a token for
   * an old address must not confirm a new one, which is why `email` is denormalised
   * onto the token row.
   */
  async verify(token: string): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const record = await this.findUsable(token, manager);

      if (record === null) {
        // One message for unknown, spent and expired. A token is a live
        // credential until it is spent, so telling those apart is a leak.
        throw new BadRequestException(
          'This verification link is invalid or has expired',
        );
      }

      const user = await manager.findOne(User, {
        where: { id: record.userId },
      });

      if (user === null) {
        throw new BadRequestException(
          'This verification link is invalid or has expired',
        );
      }

      if (user.email !== record.email) {
        logger.warn(
          `Verification token for user ${user.id} does not match the current ` +
            'address, refusing. Request a new link.',
        );

        throw new BadRequestException(
          'This verification link is invalid or has expired',
        );
      }

      const changed = {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      };

      if (!user.isEmailVerified || user.emailVerifiedAt === null) {
        await manager.update(User, { id: user.id }, changed);
      }

      await manager.update(
        EmailVerificationToken,
        { id: record.id },
        { usedAt: new Date() },
      );

      Object.assign(user, changed);

      logger.log(`Email verified for user ${user.id}`);

      return user;
    });
  }

  /**
   * Marks every unspent token for a user as spent.
   *
   * Called with a non-existent id on the miss path of `resend-verification`, so
   * that branch costs the same database work as the branch that finds a user.
   */
  async spendOutstandingFor(userId: string): Promise<void> {
    await this.store.update(
      EmailVerificationToken,
      { userId, usedAt: IsNull() },
      { usedAt: new Date() },
    );
  }

  /**
   * Whether a token could be used. A boolean rather than the row, so a caller
   * that answers "check your mail" learns nothing about the address.
   */
  async isUsable(token: string): Promise<boolean> {
    return (await this.findUsable(token)) !== null;
  }

  private async findUsable(
    token: string,
    manager: EntityManager = this.store,
  ): Promise<EmailVerificationToken | null> {
    return manager.findOne(EmailVerificationToken, {
      where: {
        tokenHash: hashToken(token),
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }
}
