# Configs Layer

Every environment value the application reads, in one place, as namespaced and
typed objects.

```text
configs
├── app.config.ts            app name, port, route prefix, version
├── cache.config.ts          Redis/Valkey/memory cache
├── cors.config.ts           browser origins
├── database.config.ts       TypeORM connection
├── jwt.config.ts            access and refresh token settings
├── observe.config.ts        observability provider
├── security.config.ts       helmet headers
├── swagger.config.ts        API docs
├── throttler.config.ts      rate limiting
├── two-factor.config.ts     2FA switch, encryption key, issuer
├── env.validation.ts        startup validation of the whole environment
└── index.ts                 re-exports everything
```

## Rules

- No `process.env` outside this folder. The one exception is a CLI that runs
  outside Nest, such as `src/database/data-source.ts`.
- One namespace per domain, registered with `registerAs`, and read through
  `ConfigService` by key.
- A config returns the **options object the library wants**, not a second shape
  that has to be translated. `cache.config.ts` returns `ThrottlerModuleOptions`
  and `cors.config.ts` returns Nest's `CorsOptions`, so both are passed straight
  to the library that consumes them.
- Values that are not present take their default here, and the default is
  documented in `.env.example`.

## How a value reaches a service

```ts
// the config
export const securityConfig = registerAs('security', (): SecurityConfig => ({
  enabled: process.env.SECURITY_ENABLED !== 'false',
  hsts: { maxAge: Number(process.env.SECURITY_HSTS_MAX_AGE ?? 31536000) },
}));

// the consumer
const security = this.configService.getOrThrow<SecurityConfig>('security');
```

`getOrThrow` rather than `get` with a fallback, so a missing namespace fails
loudly instead of silently using a default that was never meant to apply.

## Environment validation

`env.validation.ts` is wired into `ConfigModule.forRoot({ validate })`, so it
runs before anything connects and reports **every** problem at once rather than
one per restart.

```text
Invalid environment configuration:
  - DATABASE_URL must use one of: postgres:, postgresql:
  - JWT_SECRET must be at least 32 characters
  - JWT_REFRESH_SECRET still holds the example value
```

Strictness depends on `NODE_ENV`. Development only checks presence, so a
placeholder does not block local work. Production requires long secrets and
rejects any that still hold a value from `.env.example`, because that file is in
the repository and a secret in it is not a secret.

The schema describes the rules; zod's own messages are kept, since a schema that
says what is wrong is enough. Messages are written only for the handful of
`refine` checks where zod would otherwise say nothing useful.

Three rules are conditional rather than per-variable, because they are about a
combination being meaningful:

| Rule | Why |
| --- | --- |
| `OBSERVE_*` all set or all unset | A partial set silently disables observability |
| `CORS_CREDENTIALS` needs a real allow-list | Browsers reject credentials with a wildcard, so it would only look like it works |
| `TWO_FACTOR_ENCRYPTION_KEY` required while 2FA is on | The config defaults to a published key, so a deploy that forgets it would encrypt secrets with a value in the repository |
| `CACHE_URL` required for a shared backend | Otherwise it silently aims at localhost |

`validateEnvironment` returns the original config object, not zod's parsed copy.
Each config file does its own `Number()` conversion, so returning coerced values
would change types that `ConfigService` callers already handle.

## Adding a config

1. Add `x.config.ts` with `registerAs('x', ...)`.
2. Export it from `index.ts`.
3. Add it to the `load` array in `src/app.module.ts`.
4. Add the variable to `types/env.d.ts` and `.env.example`.
5. Add a rule for it in `env.validation.ts` if a wrong value is possible.
