import { registerAs } from '@nestjs/config';
import type { HelmetOptions } from 'helmet';

/**
 * The same shape that goes straight into `helmet()`, so there is no second set of
 * field names to keep in sync. An alias rather than an interface that extends it,
 * because extending with nothing would only add a name.
 */
export type SecurityConfig = HelmetOptions & {
  /** Whether to send any of these headers. Not a helmet option. */
  enabled: boolean;
};

const REFERRER_POLICIES = [
  'no-referrer',
  'no-referrer-when-downgrade',
  'same-origin',
  'origin',
  'strict-origin',
  'origin-when-cross-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
] as const;

/**
 * A subset of what helmet accepts, declared once and used both as the runtime
 * allow-list and as the return type, so the two cannot drift apart. Anything
 * unrecognised falls back to the value that leaks nothing.
 */
type ReferrerPolicy = (typeof REFERRER_POLICIES)[number];

function toReferrerPolicy(value: string | undefined): ReferrerPolicy {
  return REFERRER_POLICIES.find((policy) => policy === value) ?? 'no-referrer';
}

export const securityConfig = registerAs('security', (): SecurityConfig => ({
  enabled: process.env.SECURITY_ENABLED !== 'false',
  // `false` turns the header off, which is the default because the Swagger UI at
  // /docs needs inline script and style that a policy blocks. An empty object is
  // helmet's own default policy, so enabling this is a deliberate act rather than
  // the result of a field being left out.
  contentSecurityPolicy:
    process.env.SECURITY_CONTENT_SECURITY_POLICY === 'true' ? {} : false,
  hsts: { maxAge: Number(process.env.SECURITY_HSTS_MAX_AGE ?? 31536000) },
  referrerPolicy: {
    policy: toReferrerPolicy(process.env.SECURITY_REFERRER_POLICY),
  },
}));
