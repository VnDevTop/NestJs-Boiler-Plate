# Core Layer

Technical capabilities the whole application needs, kept out of the business
modules so nothing here has to know what the product does.

```text
core
├── cache/      Redis/Valkey/memory cache
├── health/     liveness, readiness, shutdown state
├── logger/     JSON logs for production
├── optional/   optional package loading and the package-free transports
└── swagger/    OpenAPI setup
```

## Rules

- Infrastructure only. A cache module, a health probe or a logger has no idea
  what a user is.
- Expose a narrow service, not the underlying client. `CacheService` is the
  whole cache API; nothing else imports the store.
- Register globally only when the capability genuinely is app wide. Both `cache`
  and `health` are `@Global`; `logger` and `swagger` are plain helpers.

## Production concerns that live elsewhere

Two hardening concerns are configured but not folders here, because they are one
call each rather than a module worth a directory:

| Concern          | Where                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| Security headers | `helmet` in `src/main.ts`, values from `src/configs/security.config.ts`                 |
| CORS             | `app.enableCors` in `src/main.ts`, values from `src/configs/cors.config.ts`             |
| Rate limiting    | `ThrottlerModule` in `src/app.module.ts`, values from `src/configs/throttler.config.ts` |
| Request id       | `src/common/middlewares`, applied in `src/app.module.ts`                                |

See `docs/production.md` for what each one does and the tradeoffs behind the
defaults.

## Adding a core module

1. `src/core/<name>/` with its own `index.ts` and a `README.md`.
2. Export it from `src/core/index.ts`.
3. Register it in `src/app.module.ts`.
4. Add configuration to `src/configs` if it needs any, including the
   `src/configs/env.validation.ts` rule.
