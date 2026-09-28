import { z } from 'zod';

/**
 * Validates the environment before anything connects, so a missing or unusable
 * setting is a clear error at boot rather than a confusing failure later.
 *
 * Only the rules are custom. Messages are zod's own, because a schema that
 * describes *what* is wrong is enough; the alternative is a lookup table of
 * wording that has to be kept in step with the constraints themselves.
 */

const PLACEHOLDER_SECRETS = new Set([
  'change-me',
  'secret',
  'password',
  'change-me-in-production',
]);

/** A Postgres schema name reaches DDL unquoted in places, so it is constrained. */
const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** 2FA is on unless it is explicitly turned off, which is what makes this key required. */
const twoFactorEnabled = (value: string | undefined): boolean =>
  value !== 'false';

function createEnvSchema(strict: boolean) {
  const secret = strict
    ? z
        .string()
        .min(32)
        .refine((value) => !PLACEHOLDER_SECRETS.has(value), {
          message: 'still holds the example value',
        })
    : z.string().min(1);

  return z
    .object({
      NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
      PORT: z.coerce.number().int().min(1).max(65535).optional(),

      APP_NAME: z.string().min(1).optional(),
      // Both end up in the request path, so a slash in them produces a route
      // nobody can call.
      API_PREFIX: z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
      API_VERSION: z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .optional(),

      // Enabled only when all three are present, so a partial set is rejected
      // below rather than quietly disabling observability.
      OBSERVE_APP_KEY: z.string().min(1).optional(),
      OBSERVE_APP_SECRET: z.string().min(1).optional(),
      OBSERVE_SERVICE_ID: z.string().min(1).optional(),

      DATABASE_URL: strict
        ? z.url().refine((value) => value.startsWith('postgres'), {
            message: 'must use one of: postgres:, postgresql:',
          })
        : z.string().optional(),
      DATABASE_SSL: z.enum(['true', 'false']).optional(),
      DATABASE_SCHEMA: z.string().regex(SQL_IDENTIFIER).optional(),

      CACHE_URL: z
        .url()
        .refine((value) => /^rediss?:/.test(value), {
          message: 'must use one of: redis:, rediss:',
        })
        .optional(),
      CACHE_BACKEND: z.enum(['redis', 'valkey', 'memory']).optional(),
      CACHE_KEY_PREFIX: z.string().min(1).regex(/^\S+$/).optional(),
      CACHE_DEFAULT_TTL: z.coerce.number().positive().optional(),
      CACHE_EMPTY_TTL: z.coerce.number().positive().optional(),
      CACHE_CONNECT_TIMEOUT: z.coerce.number().positive().optional(),

      JWT_SECRET: secret,
      JWT_REFRESH_SECRET: secret,
      JWT_EXPIRES_IN: z.string().optional(),
      JWT_REFRESH_EXPIRES_IN: z.string().optional(),

      TWO_FACTOR_ENABLED: z.enum(['true', 'false']).optional(),
      TWO_FACTOR_ENCRYPTION_KEY: z.string().min(1).optional(),
      TWO_FACTOR_ISSUER: z.string().min(1).max(64).optional(),

      SECURITY_ENABLED: z.enum(['true', 'false']).optional(),
      SECURITY_CONTENT_SECURITY_POLICY: z.enum(['true', 'false']).optional(),
      SECURITY_HSTS_MAX_AGE: z.coerce.number().nonnegative().optional(),
      SECURITY_REFERRER_POLICY: z.string().min(1).optional(),

      CORS_ORIGINS: z.string().optional(),
      CORS_CREDENTIALS: z.enum(['true', 'false']).optional(),
      CORS_MAX_AGE: z.coerce.number().nonnegative().optional(),

      THROTTLE_TTL: z.coerce.number().positive().optional(),
      THROTTLE_LIMIT: z.coerce.number().positive().optional(),
      // 0 is meaningful: block for the rest of the window.
      THROTTLE_BLOCK_DURATION: z.coerce.number().nonnegative().optional(),

      // Only the seed reads the password, which states the length rule itself.
      // Rejecting it here would stop an app that never seeds from booting.
      ADMIN_EMAIL: z.email().optional(),
      ADMIN_PASSWORD: z.string().optional(),

      SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
      SWAGGER_TITLE: z.string().min(1).optional(),
      SWAGGER_DESCRIPTION: z.string().min(1).optional(),
      SWAGGER_VERSION: z
        .string()
        .regex(/^\d+\.\d+\.\d+$/)
        .optional(),
      SWAGGER_PATH: z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
    })
    .superRefine((value, ctx) => {
      const observe = [
        'OBSERVE_APP_KEY',
        'OBSERVE_APP_SECRET',
        'OBSERVE_SERVICE_ID',
      ] as const;
      const missing = observe.find((name) => !value[name]);

      // Half configured observability looks exactly like observability that is
      // switched off, which is the part worth complaining about.
      if (missing && observe.some((name) => value[name])) {
        ctx.addIssue({
          code: 'custom',
          path: [missing],
          message: `is required when the other OBSERVE_* variables are set`,
        });
      }

      // Browsers reject credentials with a wildcard, so this pairing only looks
      // like it works. An empty list has the same effect: every origin allowed.
      if (value.CORS_CREDENTIALS === 'true') {
        const origins = (value.CORS_ORIGINS ?? '').trim();

        if (!origins || origins.includes('*')) {
          ctx.addIssue({
            code: 'custom',
            path: ['CORS_CREDENTIALS'],
            message: 'requires an explicit CORS_ORIGINS allow-list',
          });
        }
      }

      // The two-factor config falls back to a published key and is on by default,
      // so a production deploy that forgets this would encrypt secrets with a
      // value that is in the repository.
      if (twoFactorEnabled(value.TWO_FACTOR_ENABLED)) {
        const key = value.TWO_FACTOR_ENCRYPTION_KEY;

        if (!key && strict) {
          ctx.addIssue({
            code: 'custom',
            path: ['TWO_FACTOR_ENCRYPTION_KEY'],
            message: 'is required while two-factor authentication is enabled',
          });
        }

        if (key && PLACEHOLDER_SECRETS.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['TWO_FACTOR_ENCRYPTION_KEY'],
            message: 'still holds the example value',
          });
        }
      }

      // A shared cache without a url would silently aim at localhost, so it is
      // required whenever the backend is not the in-process one.
      if (
        value.CACHE_BACKEND &&
        value.CACHE_BACKEND !== 'memory' &&
        !value.CACHE_URL
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['CACHE_URL'],
          message: `is required when CACHE_BACKEND is ${value.CACHE_BACKEND}`,
        });
      }
    });
}

/**
 * Turns a zod issue into one readable line, keeping the variable name.
 *
 * A missing value is reported as missing rather than as a type mismatch: zod
 * reports both as `invalid_type` and leaves `received` unset in the missing
 * case, so the original config is what distinguishes them.
 */
function formatIssue(
  issue: z.core.$ZodIssue,
  config: Record<string, unknown>,
): string {
  const name = issue.path.join('.') || 'environment';

  if (issue.code === 'invalid_type' && blank(config[name])) {
    return `- ${name}: is required`;
  }

  return `- ${name}: ${issue.message || 'is invalid'}`;
}

const blank = (value: unknown): boolean =>
  value === undefined || (typeof value === 'string' && value.trim() === '');

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const strict = String(config.NODE_ENV ?? 'development') === 'production';
  const result = createEnvSchema(strict).safeParse(config);

  if (!result.success) {
    // Every problem at once, since restarting to discover the next one is
    // exactly the loop this is meant to remove.
    const problems = result.error.issues
      .map((issue) => formatIssue(issue, config))
      .join('\n');

    throw new Error(`Invalid environment configuration:\n  ${problems}`);
  }

  // The original object is returned, not the parsed one. Each config file does
  // its own Number() conversion, so handing back zod's coerced values would
  // change types that ConfigService callers already handle.
  return config;
}
