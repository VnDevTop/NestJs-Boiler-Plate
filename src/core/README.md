# Core Layer

The `core` layer contains application-level technical modules.

## Purpose

This layer groups technical capabilities that are used by the whole application.

Examples:

- Cache module
- Logger module
- Swagger setup
- Health check
- Security setup
- Rate limit setup
- Global infrastructure providers

## Rules

- `core` can import framework/infrastructure packages.
- `core` should not contain business domain logic.
- Business modules should not become tightly coupled to core internals.
- Prefer exposing clean service abstractions from core modules.

## Suggested Structure

```text
core 
    ├── cache 
    ├── health 
    ├── logger 
    ├── security 
    ├── swagger 
    └── README.md
```

## Future Examples

Cache:
```text
core/cache/cache.module.ts 
core/cache/cache.service.ts
```

Logger:
```text
core/logger/logger.module.ts 
core/logger/logger.service.ts
```

Swagger:
```text
core/swagger/swagger.setup.ts

```

Health:
```text
core/health/health.controller.ts 
core/health/health.module.ts

```

