import { describe, expect, it } from 'vitest';

import {
  MAIL_EMAIL_BUCKET,
  MAIL_THROTTLE,
  mailThrottleOptions,
} from '../constants/index.js';
import {
  extractEmail,
  ThrottleByEmailGuard,
} from './throttle-by-email.guard.js';

describe('extractEmail', () => {
  it('reads the address out of a body', () => {
    expect(extractEmail({ email: 'a@x.com' })).toBe('a@x.com');
  });

  it('lowercases, since the same mailbox has one budget', () => {
    // Otherwise A@x.com and a@x.com are two accounts to a limiter that is
    // trying to protect one mailbox.
    expect(extractEmail({ email: 'A@X.com' })).toBe('a@x.com');
  });

  it('trims, so a stray space is not a second budget', () => {
    expect(extractEmail({ email: '  a@x.com  ' })).toBe('a@x.com');
  });

  it('returns null for a body with no address', () => {
    expect(extractEmail({})).toBeNull();
    expect(extractEmail({ email: '' })).toBeNull();
    expect(extractEmail({ email: '   ' })).toBeNull();
  });

  it('returns null for a non-string email, rather than hashing an object', () => {
    expect(extractEmail({ email: 42 })).toBeNull();
    expect(extractEmail({ email: { toString: () => 'a@x.com' } })).toBeNull();
  });

  it('handles a missing or non-object body', () => {
    expect(extractEmail(undefined)).toBeNull();
    expect(extractEmail(null)).toBeNull();
    expect(extractEmail('string')).toBeNull();
  });
});

describe('mailThrottleOptions', () => {
  it('declares the per-address limit from the plan', () => {
    expect(mailThrottleOptions()[MAIL_EMAIL_BUCKET]).toEqual({
      limit: 3,
      ttl: 3_600_000,
    });
  });

  it('declares the per-ip limit from the plan', () => {
    expect(mailThrottleOptions().default).toEqual({
      limit: 10,
      ttl: 3_600_000,
    });
  });

  it('uses a one hour window for both', () => {
    const options = mailThrottleOptions();

    expect(options.default.ttl).toBe(MAIL_THROTTLE.windowMs);
    expect(options[MAIL_EMAIL_BUCKET].ttl).toBe(MAIL_THROTTLE.windowMs);
  });

  it('gives a fresh object each call, so a route cannot mutate the shared one', () => {
    // The literals are 10 and 3, so the assignment needs a cast; the point is
    // that the second call is unaffected, not that the number is valid.
    const first = mailThrottleOptions() as {
      default: { limit: number };
      [MAIL_EMAIL_BUCKET]: { limit: number };
    };
    first.default.limit = 9999;

    expect(mailThrottleOptions().default.limit).toBe(10);
  });
});

/** A context with the surface both the guard and the parent key touch. */
function contextWithBody(body: unknown) {
  return {
    getClass: () => class AuthController {},
    getHandler: () => function forgotPassword() {},
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  };
}

describe('ThrottleByEmailGuard keying', () => {
  /** Calls the protected hook, which TypeScript keeps out of the public surface. */
  function keyFor(
    instance: ThrottleByEmailGuard,
    body: unknown,
    name: string,
  ): string {
    const generate = (
      instance as unknown as {
        generateKey: (c: unknown, s: string, n: string) => string;
      }
    ).generateKey.bind(instance);

    return generate(contextWithBody(body), '1.2.3.4', name);
  }

  function guard() {
    return new ThrottleByEmailGuard(
      { throttlers: [] } as never,
      { increment: async () => ({}) } as never,
      { getAllAndOverride: () => undefined } as never,
    );
  }

  it('keys the per-address bucket on the address in the body', () => {
    const instance = guard();

    const byEmail = keyFor(instance, { email: 'a@x.com' }, MAIL_EMAIL_BUCKET);
    const other = keyFor(instance, { email: 'b@x.com' }, MAIL_EMAIL_BUCKET);

    // Two mailboxes, two budgets: this is what stops one attacker draining
    // somebody else's inbox.
    expect(byEmail).not.toBe(other);
  });

  it('gives the same budget to two spellings of one mailbox', () => {
    const instance = guard();

    expect(keyFor(instance, { email: 'a@x.com' }, MAIL_EMAIL_BUCKET)).toBe(
      keyFor(instance, { email: 'A@X.com' }, MAIL_EMAIL_BUCKET),
    );
  });

  it('gives the same budget to the same address across requests', () => {
    const instance = guard();

    expect(keyFor(instance, { email: 'a@x.com' }, MAIL_EMAIL_BUCKET)).toBe(
      keyFor(instance, { email: 'a@x.com' }, MAIL_EMAIL_BUCKET),
    );
  });

  it('leaves the per-ip bucket on the socket, so spraying many addresses is still caught', () => {
    const instance = guard();

    // Both bodies come from the same client. The per-address key would let this
    // through, which is exactly why the per-ip bucket has to remain.
    const a = keyFor(instance, { email: 'a@x.com' }, 'default');
    const b = keyFor(instance, { email: 'b@x.com' }, 'default');

    expect(a).toBe(b);
  });

  it('stops varying on the body when it carries no address', () => {
    const instance = guard();

    // With no address there is nothing to limit by account, so the key falls
    // back to the client. What matters is that it stops tracking the body.
    const empty = keyFor(instance, {}, MAIL_EMAIL_BUCKET);
    const other = keyFor(instance, { email: '' }, MAIL_EMAIL_BUCKET);

    expect(empty).toBe(other);
  });

  it('puts no address into the key, because the parent hashes the suffix', () => {
    const instance = guard();
    const key = keyFor(
      instance,
      { email: 'ada@example.com' },
      MAIL_EMAIL_BUCKET,
    );

    // The key is what lands in the throttler store. A raw address there would
    // be a copy of the user table in a place nobody thinks to protect, so this
    // asserts the whole path, not the helper this guard happens to call.
    expect(key).not.toContain('ada');
    expect(key).not.toContain('example.com');
  });

  it('uses the address when there is one, so the two differ', () => {
    const instance = guard();

    expect(keyFor(instance, { email: 'a@x.com' }, MAIL_EMAIL_BUCKET)).not.toBe(
      keyFor(instance, {}, MAIL_EMAIL_BUCKET),
    );
  });

  it('keys the two buckets differently, so one limit cannot mask the other', () => {
    const instance = guard();

    expect(keyFor(instance, { email: 'a@x.com' }, MAIL_EMAIL_BUCKET)).not.toBe(
      keyFor(instance, { email: 'a@x.com' }, 'default'),
    );
  });
});
