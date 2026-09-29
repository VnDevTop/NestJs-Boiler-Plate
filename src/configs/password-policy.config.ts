import { registerAs } from '@nestjs/config';

/**
 * Password policy settings.
 *
 * Not exported from `configs/index.ts` and not in the `load` array of
 * `app.module.ts`: loaded with `ConfigModule.forFeature()` inside
 * `AuthModule`, so the policy is defined next to the endpoints that enforce it.
 *
 * Phase 19 replaces the hard-coded `@MinLength(8)` in the auth DTOs with a
 * zod schema built from this namespace, so the rule is one object rather than
 * a number repeated in two DTOs.
 */

export interface PasswordPolicyConfig {
  /** Minimum length. */
  minLength: number;
  /**
   * Maximum length. Not a limit the hash imposes: scrypt has no 72 byte
   * truncation, so this is a bound on the work an attacker can ask for, since
   * hashing cost grows with the input.
   */
  maxLength: number;
  /**
   * Minimum count of each character class. Every class is 1 by default, which
   * is a length-plus-mixing rule rather than a composition gauntlet: requiring
   * all four rejects passphrases, which are longer and stronger than the
   * passwords a composition rule pushes people towards.
   */
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  /** How many of the previous passwords are kept and checked for reuse. */
  historyCount: number;
  /**
   * Whether a new password is checked against a breach list over the
   * k-anonymity API, so the password itself never leaves the server. Off by
   * default because it is a network call in the request path.
   */
  checkBreachList: boolean;
  /** Failed sign-ins before the account locks. 0 disables the lockout. */
  maxFailedAttempts: number;
  /** Minutes an account stays locked once the limit is reached. */
  lockoutDuration: number;
}

const flag = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value === 'true';

export const passwordPolicyConfig = registerAs(
  'passwordPolicy',
  (): PasswordPolicyConfig => ({
    minLength: Number(process.env.PASSWORD_MIN_LENGTH ?? 8),
    maxLength: Number(process.env.PASSWORD_MAX_LENGTH ?? 128),
    requireLowercase: flag(process.env.PASSWORD_REQUIRE_LOWERCASE, true),
    requireUppercase: flag(process.env.PASSWORD_REQUIRE_UPPERCASE, true),
    requireNumber: flag(process.env.PASSWORD_REQUIRE_NUMBER, true),
    requireSymbol: flag(process.env.PASSWORD_REQUIRE_SYMBOL, true),
    historyCount: Number(process.env.PASSWORD_HISTORY_COUNT ?? 5),
    checkBreachList: flag(process.env.PASSWORD_CHECK_BREACH_LIST, false),
    maxFailedAttempts: Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS ?? 5),
    lockoutDuration: Number(process.env.LOGIN_LOCKOUT_DURATION ?? 15),
  }),
);
