import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.validation.js';

/** A configuration that passes in development, so each test can break one thing. */
function base(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    NODE_ENV: 'development',
    JWT_SECRET: 'change-me',
    JWT_REFRESH_SECRET: 'change-me',
    ...overrides,
  };
}

const production = (overrides: Record<string, unknown> = {}) =>
  base({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/app',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    TWO_FACTOR_ENCRYPTION_KEY: 'c'.repeat(32),
    ...overrides,
  });

function problemsFor(config: Record<string, unknown>): string[] {
  try {
    validateEnvironment(config);
  } catch (error) {
    return (
      (error as Error).message
        .split('\n')
        .map((line) => line.trim())
        // The first line is the "Invalid environment configuration" header.
        .filter((line) => line.startsWith('- '))
    );
  }

  return [];
}

/** Asserts a variable is rejected, without pinning the wording. */
function rejects(config: Record<string, unknown>, variable: string): void {
  expect(problemsFor(config).join('\n')).toContain(variable);
}

describe('validateEnvironment', () => {
  it('accepts a development configuration with placeholder secrets', () => {
    expect(() => validateEnvironment(base())).not.toThrow();
  });

  it('returns the configuration unchanged rather than the parsed copy', () => {
    // Each config file does its own Number() conversion, so handing back zod's
    // coerced values would change types ConfigService callers handle.
    const config = base({ PORT: '3000' });

    expect(validateEnvironment(config)).toBe(config);
  });

  it('reports a missing required variable as missing', () => {
    expect(problemsFor(base({ JWT_SECRET: undefined }))).toEqual([
      '- JWT_SECRET: is required',
    ]);
  });

  it('reports every problem at once instead of only the first', () => {
    const problems = problemsFor(
      base({ JWT_SECRET: undefined, JWT_REFRESH_SECRET: undefined }),
    );

    expect(problems.length).toBeGreaterThan(1);
  });

  it('tells a value it cannot read from one that is merely out of range', () => {
    // Both are type problems in zod, and reporting them identically would send
    // you looking in the wrong place when the value is simply too large.
    expect(problemsFor(production({ PORT: 'abc' }))).toContain(
      '- PORT: Invalid input: expected number, received NaN',
    );
    expect(problemsFor(production({ PORT: '70000' }))).toContain(
      '- PORT: Too big: expected number to be <=65535',
    );
  });

  it('keeps the variable name in front of the reason', () => {
    expect(problemsFor(production({ NODE_ENV: 'staging' }))).toEqual([
      '- NODE_ENV: Invalid option: expected one of "development"|"test"|"production"',
    ]);
  });

  it('rejects a database url with the wrong protocol', () => {
    expect(
      problemsFor(production({ DATABASE_URL: 'mysql://u:p@localhost/app' })),
    ).toContain('- DATABASE_URL: must use one of: postgres:, postgresql:');
  });

  it('reports a blank url as invalid and as the wrong protocol', () => {
    // A blank value fails both checks, and saying so twice is more useful than
    // either message alone.
    expect(problemsFor(production({ DATABASE_URL: '   ' }))).toEqual([
      '- DATABASE_URL: Invalid URL',
      '- DATABASE_URL: must use one of: postgres:, postgresql:',
    ]);
  });

  it('rejects a cache url that is not a redis url', () => {
    expect(
      problemsFor(production({ CACHE_URL: 'http://localhost:6379' })),
    ).toEqual(['- CACHE_URL: must use one of: redis:, rediss:']);
  });

  it('accepts a rediss cache url', () => {
    expect(
      problemsFor(production({ CACHE_URL: 'rediss://user:pw@host:16379/0' })),
    ).toEqual([]);
  });

  it('rejects a schema name that is not a plain SQL identifier', () => {
    // The name reaches DDL, so anything else is either a mistake or an attempt
    // to smuggle a statement in.
    rejects(
      production({ DATABASE_SCHEMA: 'app; DROP TABLE x' }),
      'DATABASE_SCHEMA',
    );
    rejects(production({ DATABASE_SCHEMA: '1app' }), 'DATABASE_SCHEMA');
    expect(() =>
      validateEnvironment(production({ DATABASE_SCHEMA: 'app_v2' })),
    ).not.toThrow();
  });

  it('rejects a route prefix or docs path containing a slash', () => {
    for (const name of ['API_PREFIX', 'SWAGGER_PATH']) {
      rejects(production({ [name]: 'api/v1' }), name);
    }
  });

  it('rejects a cache key prefix containing whitespace', () => {
    // The prefix is part of every Redis key, so a space here produces keys that
    // are painful to inspect.
    rejects(production({ CACHE_KEY_PREFIX: 'my app' }), 'CACHE_KEY_PREFIX');
  });

  it('accepts both accepted version shapes and rejects anything else', () => {
    expect(() =>
      validateEnvironment(production({ API_VERSION: '1' })),
    ).not.toThrow();
    expect(() =>
      validateEnvironment(production({ API_VERSION: '1.0' })),
    ).not.toThrow();
    rejects(production({ API_VERSION: 'v1' }), 'API_VERSION');
    rejects(production({ SWAGGER_VERSION: '1.0' }), 'SWAGGER_VERSION');
  });

  it('rejects a boolean variable that is not true or false', () => {
    for (const name of [
      'DATABASE_SSL',
      'TWO_FACTOR_ENABLED',
      'SWAGGER_ENABLED',
      'SECURITY_ENABLED',
      'SECURITY_CONTENT_SECURITY_POLICY',
    ]) {
      rejects(production({ [name]: 'maybe' }), name);
    }
  });

  it('rejects a negative duration', () => {
    for (const name of [
      'SECURITY_HSTS_MAX_AGE',
      'CORS_MAX_AGE',
      'THROTTLE_BLOCK_DURATION',
    ]) {
      rejects(production({ [name]: '-1' }), name);
    }
  });

  it('accepts zero for throttler block duration', () => {
    // 0 is the documented default and means "block for the rest of the window",
    // so it must not be treated as a missing or invalid value.
    expect(problemsFor(production({ THROTTLE_BLOCK_DURATION: '0' }))).toEqual(
      [],
    );
  });

  it('rejects a malformed admin email', () => {
    expect(problemsFor(production({ ADMIN_EMAIL: 'not-an-email' }))).toEqual([
      '- ADMIN_EMAIL: Invalid email address',
    ]);
  });

  it('requires a long secret in production but not in development', () => {
    rejects(production({ JWT_SECRET: 'short' }), 'JWT_SECRET');
    expect(() =>
      validateEnvironment(base({ JWT_SECRET: 'short' })),
    ).not.toThrow();
  });

  it('names the example value, not just the length, when that is the problem', () => {
    // The example ships in the repository, so in production it is not a secret.
    // Saying so is more useful than only reporting that it is too short. Both
    // problems are reported, and the order is left to zod.
    const problems = problemsFor(production({ JWT_SECRET: 'change-me' }));

    expect(problems).toContain(
      '- JWT_SECRET: Too small: expected string to have >=32 characters',
    );
    expect(problems).toContain('- JWT_SECRET: still holds the example value');
  });

  it('requires a database url in production only', () => {
    expect(problemsFor(production({ DATABASE_URL: undefined }))).toEqual([
      '- DATABASE_URL: is required',
    ]);
    expect(() =>
      validateEnvironment(base({ DATABASE_URL: undefined })),
    ).not.toThrow();
  });

  it('requires the 2fa key whenever two-factor authentication is on', () => {
    // The config falls back to a published key and is enabled by default, so a
    // production deploy without this would encrypt secrets with a value in the
    // repository.
    expect(
      problemsFor(production({ TWO_FACTOR_ENCRYPTION_KEY: undefined })),
    ).toEqual([
      '- TWO_FACTOR_ENCRYPTION_KEY: is required while two-factor authentication is enabled',
    ]);
    // Turning 2FA off is what makes the key unnecessary.
    expect(
      problemsFor(
        production({
          TWO_FACTOR_ENABLED: 'false',
          TWO_FACTOR_ENCRYPTION_KEY: undefined,
        }),
      ),
    ).toEqual([]);
  });

  it('rejects a 2fa key that still holds the example value', () => {
    expect(
      problemsFor(production({ TWO_FACTOR_ENCRYPTION_KEY: 'change-me' })),
    ).toEqual(['- TWO_FACTOR_ENCRYPTION_KEY: still holds the example value']);
  });

  it('requires a cache url for a shared cache backend', () => {
    // Otherwise the default points at localhost and fails much later.
    expect(
      problemsFor(production({ CACHE_BACKEND: 'redis', CACHE_URL: undefined })),
    ).toEqual(['- CACHE_URL: is required when CACHE_BACKEND is redis']);
    expect(
      problemsFor(
        production({ CACHE_BACKEND: 'memory', CACHE_URL: undefined }),
      ),
    ).toEqual([]);
  });

  it('rejects a partially configured observe integration', () => {
    // Half configured observability looks exactly like observability that is
    // switched off, which is the part worth complaining about.
    expect(problemsFor(production({ OBSERVE_APP_KEY: 'key' }))).toEqual([
      '- OBSERVE_APP_SECRET: is required when the other OBSERVE_* variables are set',
    ]);
  });

  it('accepts observe when all three are set or all are absent', () => {
    const all = {
      OBSERVE_APP_KEY: 'key',
      OBSERVE_APP_SECRET: 'secret',
      OBSERVE_SERVICE_ID: 'service',
    };

    expect(problemsFor(production(all))).toEqual([]);
    expect(problemsFor(production({}))).toEqual([]);
  });

  it('rejects credentials with a wildcard origin', () => {
    // Browsers refuse this pairing, so a config like it only appears to work.
    expect(
      problemsFor(production({ CORS_CREDENTIALS: 'true', CORS_ORIGINS: '*' })),
    ).toEqual([
      '- CORS_CREDENTIALS: requires an explicit CORS_ORIGINS allow-list',
    ]);
  });

  it('rejects credentials with no allow-list at all', () => {
    expect(
      problemsFor(production({ CORS_CREDENTIALS: 'true', CORS_ORIGINS: '' })),
    ).toEqual([
      '- CORS_CREDENTIALS: requires an explicit CORS_ORIGINS allow-list',
    ]);
  });

  it('accepts credentials with a real allow-list', () => {
    expect(
      problemsFor(
        production({
          CORS_CREDENTIALS: 'true',
          CORS_ORIGINS: 'https://app.example.com',
        }),
      ),
    ).toEqual([]);
  });

  it('accepts every documented mail transport', () => {
    for (const name of ['memory', 'smtp', 'ses', 'sendgrid']) {
      expect(problemsFor(production({ MAIL_TRANSPORT: name }))).toEqual([]);
    }
  });

  it('rejects a transport name that is not a transport', () => {
    // Cast because the point of the test is a value the types rule out.
    rejects(
      base({ MAIL_TRANSPORT: 'carrier-pigeon' as unknown as 'smtp' }),
      'MAIL_TRANSPORT',
    );
  });

  it('rejects a from address that is not an email', () => {
    rejects(base({ MAIL_FROM: 'noreply' }), 'MAIL_FROM');
  });

  it('rejects a reply-to address that is not an email', () => {
    rejects(base({ MAIL_REPLY_TO: 'support' }), 'MAIL_REPLY_TO');
  });

  it('rejects a smtp port outside the tcp range', () => {
    rejects(base({ MAIL_SMTP_PORT: '70000' }), 'MAIL_SMTP_PORT');
  });

  it('rejects a non-boolean secure flag', () => {
    rejects(base({ MAIL_SMTP_SECURE: 'yes' }), 'MAIL_SMTP_SECURE');
  });

  it('rejects a non-positive timeout', () => {
    rejects(base({ MAIL_SOCKET_TIMEOUT: '0' }), 'MAIL_SOCKET_TIMEOUT');
  });

  it('does not require mail settings, since no provider may be enabled', () => {
    // A deployment that never sends mail must not be told to configure a
    // from address, or the namespace would be mandatory for a feature off.
    expect(problemsFor(production({}))).toEqual([]);
  });

  it('does not police the smtp password, which a provider may leave empty', () => {
    expect(problemsFor(production({ MAIL_SMTP_PASSWORD: '' }))).toEqual([]);
  });

  it('requires the credential for a channel that is switched on', () => {
    // A channel with no credential is a channel that drops every message,
    // which is indistinguishable from a working one from the outside.
    expect(problemsFor(base({ TELEGRAM_ENABLED: 'true' }))).toEqual([
      '- TELEGRAM_BOT_TOKEN: is required when TELEGRAM_ENABLED is true',
      '- TELEGRAM_CHAT_ID: is required when TELEGRAM_ENABLED is true',
    ]);
  });

  it('requires a webhook url for a webhook channel that is switched on', () => {
    expect(problemsFor(base({ SLACK_ENABLED: 'true' }))).toEqual([
      '- SLACK_WEBHOOK_URL: is required when SLACK_ENABLED is true',
    ]);
    expect(problemsFor(base({ DISCORD_ENABLED: 'true' }))).toEqual([
      '- DISCORD_WEBHOOK_URL: is required when DISCORD_ENABLED is true',
    ]);
  });

  it('accepts a channel that is switched on with its credential', () => {
    expect(
      problemsFor(
        base({
          TELEGRAM_ENABLED: 'true',
          TELEGRAM_BOT_TOKEN: 'token',
          TELEGRAM_CHAT_ID: '-100',
        }),
      ),
    ).toEqual([]);
  });

  it('does not require a credential for a channel that is switched off', () => {
    // The credentials stay harmless, so an operator can stage them ahead of
    // turning the channel on.
    expect(problemsFor(base({ SLACK_WEBHOOK_URL: undefined }))).toEqual([]);
  });

  it('requires a webhook url to be https, since it carries the credential', () => {
    rejects(base({ SLACK_WEBHOOK_URL: 'http://hooks/x' }), 'SLACK_WEBHOOK_URL');
  });

  it('rejects a negative retry count', () => {
    rejects(base({ NOTIFICATION_RETRIES: '-1' }), 'NOTIFICATION_RETRIES');
  });

  it('does not police the admin password, which only the seed reads', () => {
    // Rejecting it here would stop an app that never seeds from booting; the
    // seeder states the length rule where it matters.
    expect(problemsFor(production({ ADMIN_PASSWORD: 'x' }))).toEqual([]);
  });

  it('accepts a production configuration that satisfies everything', () => {
    expect(() => validateEnvironment(production())).not.toThrow();
  });
});
