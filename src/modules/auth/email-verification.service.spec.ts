import { BadRequestException } from '@nestjs/common';
import { IsNull } from 'typeorm';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hashToken } from '../../common/utils/index.js';
import { EmailVerificationService } from './email-verification.service.js';
import { EmailVerificationToken } from './entities/index.js';

const USER = { id: 'user-1', email: 'a@x.com' } as never;

function usableRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    userId: 'user-1',
    tokenHash: hashToken('the-token'),
    email: 'a@x.com',
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  } as EmailVerificationToken;
}

function build(
  options: { row?: EmailVerificationToken | null; user?: unknown } = {},
) {
  const row = 'row' in options ? (options.row ?? null) : usableRow();
  const user =
    'user' in options
      ? options.user
      : {
          id: 'user-1',
          email: 'a@x.com',
          isEmailVerified: false,
          emailVerifiedAt: null,
        };

  const manager = {
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    findOne: vi
      .fn()
      .mockImplementation((entity) =>
        Promise.resolve(entity === EmailVerificationToken ? row : user),
      ),
    save: vi.fn().mockImplementation((value) => Promise.resolve(value)),
    create: vi.fn().mockImplementation((_entity, value) => value),
  };

  const transaction = vi.fn().mockImplementation((handler) => handler(manager));
  const service = new EmailVerificationService(
    { manager } as never,
    { transaction } as never,
  );

  return { service, manager, transaction, user: user as { id: string } };
}

describe('EmailVerificationService.issue', () => {
  it('stores a hash, never the token it hands out', async () => {
    const { service, manager } = build();

    const issued = await service.issue(USER, 'a@x.com', '203.0.113.7');

    const saved = manager.save.mock.calls[0][0] as { tokenHash: string };
    expect(saved.tokenHash).not.toBe(issued.token);
    expect(saved.tokenHash).toHaveLength(64);
  });

  it('records the address the token confirms, so a later change cannot reuse it', async () => {
    const { service, manager } = build();

    await service.issue(USER, 'a@x.com', null);

    expect((manager.save.mock.calls[0][0] as { email: string }).email).toBe(
      'a@x.com',
    );
  });

  it('expires in twenty four hours, longer than a reset link', async () => {
    // Losing an address on signup is a dead end; a reset is a repeatable request.
    const { service } = build();

    const { expiresAt } = await service.issue(USER, 'a@x.com', null);

    expect(Math.round((expiresAt.getTime() - Date.now()) / 3_600_000)).toBe(24);
  });

  it('spends the outstanding tokens, so a link already in an inbox stops working', async () => {
    const { service, manager } = build();

    await service.issue(USER, 'a@x.com', null);

    expect(manager.update).toHaveBeenCalledWith(
      EmailVerificationToken,
      { userId: 'user-1', usedAt: IsNull() },
      { usedAt: expect.any(Date) },
    );
  });

  it('records the requesting ip', async () => {
    const { service, manager } = build();

    await service.issue(USER, 'a@x.com', '203.0.113.7');

    expect(
      (manager.save.mock.calls[0][0] as { ipAddress: string }).ipAddress,
    ).toBe('203.0.113.7');
  });
});

describe('EmailVerificationService.verify', () => {
  let service: EmailVerificationService;
  let manager: ReturnType<typeof build>['manager'];

  beforeEach(() => {
    ({ service, manager } = build());
  });

  it('marks the address confirmed', async () => {
    await service.verify('the-token');

    expect(manager.update).toHaveBeenCalledWith(
      expect.any(Function),
      { id: 'user-1' },
      { isEmailVerified: true, emailVerifiedAt: expect.any(Date) },
    );
  });

  it('spends the token in the same transaction, so a link cannot be reused', async () => {
    const fresh = build();

    await fresh.service.verify('the-token');

    expect(fresh.transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown token', async () => {
    const unknown = build({ row: null });

    await expect(unknown.service.verify('nope')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a spent token', async () => {
    const spent = build({ row: null });

    await expect(spent.service.verify('the-token')).rejects.toThrow(
      /invalid or has expired/,
    );
  });

  it('refuses a token minted for an address the user has since changed', async () => {
    // Otherwise a token for a@x.com would confirm b@x.com, which is not what it
    // was issued for.
    const changed = build({
      user: { id: 'user-1', email: 'b@x.com', isEmailVerified: false },
    });

    await expect(changed.service.verify('the-token')).rejects.toThrow(
      /invalid or has expired/,
    );
  });

  it('does not rewrite the timestamp on a second confirmation', async () => {
    const already = build({
      user: {
        id: 'user-1',
        email: 'a@x.com',
        isEmailVerified: true,
        emailVerifiedAt: new Date('2020-01-01'),
      },
    });

    await already.service.verify('the-token');

    expect(already.manager.update).not.toHaveBeenCalledWith(
      expect.any(Function),
      { id: 'user-1' },
      expect.anything(),
    );
  });

  it('rejects when the user no longer exists', async () => {
    const gone = build({ user: null });

    await expect(gone.service.verify('the-token')).rejects.toThrow(
      /invalid or has expired/,
    );
  });

  it('gives the same message for unknown, spent and mismatched', async () => {
    const messages = await Promise.all(
      [
        build({ row: null }),
        build({ row: null }),
        build({ user: { id: 'u', email: 'other@x.com' } }),
      ].map((h) =>
        h.service.verify('the-token').catch((e: Error) => e.message),
      ),
    );

    expect(new Set(messages).size).toBe(1);
  });

  it('only accepts a token that is unspent and unexpired', async () => {
    await service.verify('the-token');

    const [entity, options] = manager.findOne.mock.calls[0];
    expect(entity).toBe(EmailVerificationToken);
    expect(options.where.tokenHash).toBe(hashToken('the-token'));
    expect(options.where).toHaveProperty('usedAt');
    expect(options.where.expiresAt.type).toBe('moreThan');
  });
});

describe('EmailVerificationService.isUsable', () => {
  it('is true for a token that could be spent', async () => {
    await expect(build().service.isUsable('the-token')).resolves.toBe(true);
  });

  it('is false for an unknown token', async () => {
    await expect(build({ row: null }).service.isUsable('nope')).resolves.toBe(
      false,
    );
  });
});
