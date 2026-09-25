# Configs Layer

The `configs` layer contains application configuration definitions.

## Purpose

This layer centralizes all environment-based configuration used by the application.

Examples:

- App configuration
- Database configuration
- JWT configuration
- Redis configuration
- Swagger configuration
- Observability configuration
- Security configuration

## Rules

- Do not hard-code environment values inside modules or services.
- Keep config files small and focused by domain.
- Prefer typed and namespaced configs.
- Config files should be loaded by `ConfigModule`.

## Suggested Structure
```text
configs 
    ├── app.config.ts 
    ├── database.config.ts 
    ├── jwt.config.ts 
    ├── redis.config.ts 
    ├── swagger.config.ts 
    ├── observe.config.ts 
    └── index.ts
```
## Examples

A module should consume config values through NestJS config providers rather than reading `process.env` directly.

Recommended:
```typescript
  constructor(private readonly configService: ConfigService) {}
```
Avoid:
```typescript
const secret = process.env.JWT_SECRET;
```

