import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { retentionConfig } from './retention.config.js';

const KEYS = [
  'RETENTION_ENABLED',
  'RETENTION_DRY_RUN',
  'RETENTION_SCHEDULE',
  'RETENTION_BATCH_SIZE',
  'RETENTION_BATCH_DELAY',
  'RETENTION_RUN_TIMEOUT',
  'RETENTION_USERS_DAYS',
  'RETENTION_EMAIL_TOKENS_DAYS',
  'RETENTION_RESET_TOKENS_DAYS',
  'RETENTION_REFRESH_TOKENS_DAYS',
  'RETENTION_MAIL_LOGS_DAYS',
  'RETENTION_NOTIFICATION_LOGS_DAYS',
  'RETENTION_LOGIN_ATTEMPTS_DAYS',
  'RETENTION_AUDIT_LOGS_DAYS',
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

describe('retentionConfig', () => {
  it('is off by default, so nothing is deleted until it is asked for', () => {
    expect(retentionConfig().enabled).toBe(false);
  });

  it('is not a dry run by default, but the flag is one env var away', () => {
    expect(retentionConfig().dryRun).toBe(false);
  });

  it('defaults to the policy in the plan', () => {
    expect(retentionConfig().ages).toEqual({
      softDeletedUsers: 30,
      emailVerificationTokens: 7,
      passwordResetTokens: 7,
      refreshTokens: 7,
      mailLogs: 30,
      notificationLogs: 30,
      loginAttempts: 7,
      auditLogs: 365,
    });
  });

  it('keeps the audit trail far longer than the log tables', () => {
    // A month of audit logs is not an audit log.
    expect(retentionConfig().ages.auditLogs).toBeGreaterThan(
      retentionConfig().ages.mailLogs,
    );
  });

  it('overrides each age independently', () => {
    process.env.RETENTION_USERS_DAYS = '90';
    process.env.RETENTION_MAIL_LOGS_DAYS = '7';

    const { ages } = retentionConfig();

    expect(ages.softDeletedUsers).toBe(90);
    expect(ages.mailLogs).toBe(7);
    expect(ages.refreshTokens).toBe(7);
  });

  it('batches deletions, so a batch never holds a lock for long', () => {
    expect(retentionConfig().batchSize).toBe(5_000);
    expect(retentionConfig().batchDelay).toBe(100);
  });

  it('gives up on a run rather than overlapping with the next one', () => {
    process.env.RETENTION_RUN_TIMEOUT = '900000';

    expect(retentionConfig().runTimeout).toBe(900_000);
  });

  it('accepts a custom schedule', () => {
    process.env.RETENTION_SCHEDULE = '0 4 * * 0';

    expect(retentionConfig().schedule).toBe('0 4 * * 0');
  });

  it('schedules off-peak by default', () => {
    // Hour 3 is off-peak; the minute is odd so it does not collide with the
    // rest of the fleet.
    expect(retentionConfig().schedule).toMatch(/^17 3 /);
  });
});
