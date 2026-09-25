# NestJS Boilerplate Implementation Plan

## Goal

Build a production-ready NestJS boilerplate that can be reused as a GitHub template.

Long-term target:

- JWT authentication
- Refresh tokens
- Two-factor authentication
- Device authentication
- Authorization with RBAC and future permissions
- TypeORM database integration
- Redis cache
- Validation
- Swagger API documentation
- Scalable modular architecture
- Centralized filters, pipes, guards, interceptors, decorators, and technical utilities

Current focus:

- Establish project architecture
- Prepare clear folder/layer boundaries
- Implement common and simple foundations first
- Keep the codebase easy to extend and easy to review through small commits

---

## Layer Overview

The project is organized into the following main layers:

```text
src 
├── configs 
├── database 
├── common 
├── core 
└── modules
```

### `configs`

Application configuration layer.

Responsibilities:

- Load and expose environment-based configuration
- Define configuration namespaces
- Keep configuration centralized and type-safe
- Avoid hard-coded values in modules/services

Examples:

- App config
- Database config
- JWT config
- Redis config
- Observe/telemetry config
- Swagger config

---

### `database`

Database infrastructure layer.

Responsibilities:

- TypeORM setup-related files
- Migrations
- Seeds
- Factories
- Base database entities
- Database subscribers
- Shared database utilities

This layer should not contain business logic.

Examples:

- `migrations`
- `seeds`
- `factories`
- `entities/base.entity.ts`
- `subscribers`

---

### `common`

Reusable application building blocks.

Responsibilities:

- Decorators
- Guards
- Pipes
- Filters
- Interceptors
- Common DTOs
- Common enums
- Common constants
- Common exceptions
- Shared interfaces
- Middlewares
- Utility functions

Rules:

- `common` should not depend on business modules.
- `common` should be generic and reusable across the whole app.
- Guards in `common` should preferably rely on request context instead of directly loading business services.

Examples:

- `@Public()`
- `@CurrentUser()`
- `@Roles()`
- `@ManagerOnly()`
- `JwtAuthGuard`
- `RolesGuard`
- `ManagerGuard`
- `HttpExceptionFilter`
- `ResponseTransformInterceptor`
- `ValidationPipe`

---

### `core`

Application-level technical modules.

Responsibilities:

- Bootstrap and expose technical capabilities
- Centralize infrastructure modules used by the app
- Keep production concerns isolated from business modules

Examples:

- Logger module
- Cache module
- Swagger setup
- Health check
- Security headers / CORS / rate limit setup
- Global module providers if needed

---

### `modules`

Business modules.

Responsibilities:

- Business features
- Domain services
- Controllers
- Feature-specific DTOs
- Feature-specific entities
- Feature-specific repositories

Initial modules:

- `auth`
- `users`
- `admin`

Future modules can be added here.

Rules:

- Controllers should be thin.
- Business logic should live in services.
- Modules should avoid circular dependencies.
- Feature-specific code should stay inside its own module.

---

## Phase 0: Project Architecture Skeleton

Status: Pending

Goal:

Create the base folder structure and documentation for each layer.

Tasks:

- [ ] Create `src/configs`
- [ ] Create `src/database`
- [ ] Create `src/common`
- [ ] Create `src/core`
- [ ] Create `src/modules`
- [ ] Add README for each main layer
- [ ] Add root `PLAN.md`
- [ ] Commit architecture skeleton

Expected commit:
```text
chore: add initial scalable project structure
```

---

## Phase 1: Base Application Foundation

Status: Pending

Goal:

Add the minimal application-level foundation used by every project.

Tasks:

- [ ] Define app config
- [ ] Define JWT config placeholder
- [ ] Organize existing database config
- [ ] Add global validation pipe
- [ ] Add global exception filter
- [ ] Add global response transform interceptor
- [ ] Add common metadata constants
- [ ] Add base response DTO/interface
- [ ] Add request context interface

Expected outcome:

- App has consistent validation behavior
- App has consistent error response
- App has consistent success response
- Configs are centralized

Expected commit:
```text
feat: add base application foundation
```


---

## Phase 2: Users Module

Status: Pending

Goal:

Create the user domain foundation.

Tasks:

- [ ] Create `users.module.ts`
- [ ] Create `users.controller.ts`
- [ ] Create `users.service.ts`
- [ ] Create `user.entity.ts`
- [ ] Create create/update user DTOs
- [ ] Add basic user response DTO
- [ ] Add `Role` enum
- [ ] Add `isActive`
- [ ] Add `isManager`
- [ ] Add timestamps
- [ ] Add soft delete column if needed
- [ ] Add methods to find user by id/email
- [ ] Add basic user profile route

Expected initial user fields:
```text
id email password firstName lastName role isActive isManager lastLoginAt createdAt updatedAt deletedAt
```


Expected commit:
```text
feat: add users module foundation
```

---

## Phase 3: Auth Module - Basic JWT

Status: Pending

Goal:

Implement basic authentication using JWT access token.

Tasks:

- [ ] Create `auth.module.ts`
- [ ] Create `auth.controller.ts`
- [ ] Create `auth.service.ts`
- [ ] Create login DTO
- [ ] Create register DTO
- [ ] Add password hashing utility/service
- [ ] Add JWT payload interface
- [ ] Add JWT strategy
- [ ] Add JWT auth guard
- [ ] Add `@Public()` decorator
- [ ] Add `@CurrentUser()` decorator
- [ ] Add `/auth/register`
- [ ] Add `/auth/login`
- [ ] Add `/auth/me`

Expected routes:
```text
POST /auth/register 
POST /auth/login 
GET /auth/me
```


Expected commit:
```text
feat: add basic jwt authentication
```


---

## Phase 4: Authorization - RBAC and Manager Scope

Status: Pending

Goal:

Add authorization capabilities for role-based access and manager-only access.

Tasks:

- [ ] Add metadata constants
- [ ] Add `@Roles()` decorator
- [ ] Add `RolesGuard`
- [ ] Add `@ManagerOnly()` decorator
- [ ] Add `ManagerGuard`
- [ ] Protect manager/admin routes
- [ ] Ensure only users with `isManager = true` can access `/admin` routes
- [ ] Prepare `@Permissions()` decorator placeholder for future permission system

Expected authorization decorators:
```text
@Public() 
@CurrentUser() 
@Roles() 
@ManagerOnly() 
@Permissions()
```


Expected guards:
```text
JwtAuthGuard 
RolesGuard 
ManagerGuard 
PermissionsGuard
```


Expected commit:
```text
feat: add rbac and manager authorization foundation
```


---

## Phase 5: Admin Module Foundation

Status: Pending

Goal:

Create a clean admin route scope.

Tasks:

- [ ] Create `admin.module.ts`
- [ ] Create `admin.controller.ts`
- [ ] Create `admin.service.ts`
- [ ] Prefix admin routes with `/admin`
- [ ] Apply manager-only access
- [ ] Add basic admin health/dashboard route

Expected routes:
```text
GET /admin/dashboard
```


Expected commit:
```text
feat: add admin module foundation
```

---

## Phase 6: API Documentation

Status: Pending

Goal:

Add Swagger API documentation.

Tasks:

- [ ] Add Swagger config
- [ ] Add Swagger setup in `core/swagger`
- [ ] Add auth bearer documentation
- [ ] Add tags for Auth, Users, Admin
- [ ] Expose docs route

Expected route:
```text
GET /docs
```

Expected commit:
```text
feat: add swagger documentation foundation
```

---

## Phase 7: Refresh Tokens

Status: Pending

Goal:

Add refresh token support.

Tasks:

- [ ] Add refresh token entity
- [ ] Add refresh token DTO
- [ ] Add refresh token rotation
- [ ] Add logout
- [ ] Add logout all devices
- [ ] Store token metadata
- [ ] Revoke old refresh tokens

Expected routes:
```text
POST /auth/refresh-token 
POST /auth/logout 
POST /auth/logout-all
```

Expected commit:
```text
feat: add refresh token authentication
```

---

## Phase 8: Device Authentication

Status: Pending

Goal:

Track authenticated devices.

Tasks:

- [ ] Add user device entity
- [ ] Store device info during login
- [ ] List devices
- [ ] Revoke device
- [ ] Attach refresh tokens to devices

Expected routes:

```text
GET /auth/devices 
DELETE /auth/devices/:id
```

Expected commit:
```text
feat: add device authentication foundation
```

---

## Phase 9: Two-Factor Authentication

Status: Pending

Goal:

Add optional 2FA support.

Tasks:

- [ ] Add 2FA secret storage
- [ ] Add 2FA setup endpoint
- [ ] Add 2FA verify endpoint
- [ ] Add 2FA login flow
- [ ] Add recovery code support if needed

Expected routes:
```text
POST /auth/2fa/setup 
POST /auth/2fa/verify 
POST /auth/2fa/disable
```

Expected commit:
```text
feat: add two-factor authentication foundation
```

---

## Phase 10: Cache and Performance

Status: Pending

Goal:

Add Redis cache foundation.

Tasks:

- [ ] Add Redis config
- [ ] Add cache module
- [ ] Add cache service abstraction
- [ ] Add cache key constants
- [ ] Add cache decorators/helpers if needed

Expected commit:
```text
feat: add redis cache foundation
```

---

## Phase 11: Production Hardening

Status: Pending

Goal:

Prepare the boilerplate for production usage.

Tasks:

- [ ] Add rate limiting
- [ ] Add security headers
- [ ] Add CORS config
- [ ] Add request id
- [ ] Add structured logging
- [ ] Add health check
- [ ] Add graceful shutdown
- [ ] Add environment validation
- [ ] Add seed command
- [ ] Add migration command
- [ ] Add CI workflow
- [ ] Add Dockerfile
- [ ] Add docker-compose for local development

Expected commit:
```text
chore: add production hardening foundation
```

---

## Current Execution Rule

Only implement one phase at a time.

Before starting a phase:

1. Review this plan.
2. Confirm the target phase.
3. Implement only the required files.
4. Run lint/typecheck/test when applicable.
5. Commit the phase separately.

---

## Progress Tracking

| Phase | Name | Status |
| --- | --- | --- |
| Phase 0 | Project Architecture Skeleton | Pending |
| Phase 1 | Base Application Foundation | Pending |
| Phase 2 | Users Module | Pending |
| Phase 3 | Auth Module - Basic JWT | Pending |
| Phase 4 | Authorization - RBAC and Manager Scope | Pending |
| Phase 5 | Admin Module Foundation | Pending |
| Phase 6 | API Documentation | Pending |
| Phase 7 | Refresh Tokens | Pending |
| Phase 8 | Device Authentication | Pending |
| Phase 9 | Two-Factor Authentication | Pending |
| Phase 10 | Cache and Performance | Pending |
| Phase 11 | Production Hardening | Pending |

