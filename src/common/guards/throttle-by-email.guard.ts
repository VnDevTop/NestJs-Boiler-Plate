import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

import { MAIL_EMAIL_BUCKET } from '../constants/index.js';

/**
 * Two rate limits on the routes that send mail, keyed differently on purpose.
 *
 * `ThrottlerGuard` keys on the client address, which is the wrong key for a
 * password reset: one attacker rotating addresses gets a fresh budget on every
 * request, while a real user who mistypes their password a few times cannot get a
 * reset mail at all. So there are two buckets and both must pass:
 *
 * - **Per requested address.** Stops an attacker who has one mailbox from
 *   draining it, and from using it to find out whether the account exists.
 * - **Per client address.** Stops an attacker spraying many addresses from one
 *   host, which a per-address limit cannot see.
 *
 * The switch is in `generateKey` rather than `getTracker`, because that is the
 * hook that receives the throttler name. Returning a per-body key for the
 * per-address bucket and deferring to the parent for the per-ip one keeps both
 * limits instead of replacing the ip one with it.
 */
@Injectable()
export class ThrottleByEmailGuard extends ThrottlerGuard {
  protected override generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    if (name !== MAIL_EMAIL_BUCKET) {
      return super.generateKey(context, suffix, name);
    }

    const email = extractEmail(context.switchToHttp().getRequest().body);

    if (email === null) {
      // No address in the body, so there is nothing to limit by account. The
      // per-ip bucket is still there, which is what catches it.
      return super.generateKey(context, suffix, name);
    }

    return super.generateKey(context, email, name);
  }
}

/**
 * The address from a request body, or `null` when there is none.
 *
 * Trimmed and lowercased first: `A@x.com` and `a@x.com` are the same mailbox,
 * and a limiter treating them as two hands one account double the budget.
 */
export function extractEmail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const value = (body as { email?: unknown }).email;

  return typeof value === 'string' && value.trim() !== ''
    ? value.trim().toLowerCase()
    : null;
}
