import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { passwordPolicyConfig } from './password-policy.config.js';

const KEYS = [
  'PASSWORD_MIN_LENGTH',
  'PASSWORD_MAX_LENGTH',
  'PASSWORD_REQUIRE_LOWERCASE',
  'PASSWORD_REQUIRE_UPPERCASE',
  'PASSWORD_REQUIRE_NUMBER',
  'PASSWORD_REQUIRE_SYMBOL',
  'PASSWORD_HISTORY_COUNT',
  'PASSWORD_CHECK_BREACH_LIST',
  'LOGIN_MAX_FAILED_ATTEMPTS',
  'LOGIN_LOCKOUT_DURATION',
] as const;

beforeEach(() => {
  for (const key of KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    delete process.env[key];
  }
});

describe('passwordPolicyConfig', () => {
  it('keeps the length the auth DTOs already enforce', () => {
    // register.dto and login.dto hard-code @MinLength(8) until Phase 19 reads
    // this instead, so the default must not move underneath them.
    expect(passwordPolicyConfig().minLength).toBe(8);
  });

  it('caps the maximum well above a passphrase, without a hash-imposed limit', () => {
    // scrypt hashes the whole input, so 128 is a deliberate bound on hashing
    // work rather than a length the algorithm stops reading at.
    expect(passwordPolicyConfig().maxLength).toBe(128);
  });

  it('requires each character class by default', () => {
    expect(passwordPolicyConfig()).toMatchObject({
      requireLowercase: true,
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: true,
    });
  });

  it('lets a deployment drop a class, so a passphrase policy is possible', () => {
    process.env.PASSWORD_REQUIRE_UPPERCASE = 'false';
    process.env.PASSWORD_REQUIRE_SYMBOL = 'false';

    expect(passwordPolicyConfig()).toMatchObject({
      requireUppercase: false,
      requireSymbol: false,
      requireLowercase: true,
    });
  });

  it('keeps a handful of previous passwords, to reject reuse', () => {
    expect(passwordPolicyConfig().historyCount).toBe(5);
  });

  it('leaves the breach check off, since it is a network call per signup', () => {
    expect(passwordPolicyConfig().checkBreachList).toBe(false);
  });

  it('locks an account after repeated failures', () => {
    expect(passwordPolicyConfig().maxFailedAttempts).toBe(5);
    expect(passwordPolicyConfig().lockoutDuration).toBe(15);
  });

  it('allows a deployment to disable the lockout entirely', () => {
    process.env.LOGIN_MAX_FAILED_ATTEMPTS = '0';

    expect(passwordPolicyConfig().maxFailedAttempts).toBe(0);
  });
});
