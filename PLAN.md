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

Status: Done

Goal:

Add the minimal application-level foundation used by every project.

Tasks:

- [x] Define app config
- [x] Define JWT config placeholder
- [x] Organize existing database config
- [x] Add global validation pipe
- [x] Add global exception filter
- [x] Add global response transform interceptor
- [x] Add common metadata constants
- [x] Add base response DTO/interface
- [x] Add request context interface

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

Status: Done

Goal:

Create the user domain foundation.

Tasks:

- [x] Create `users.module.ts`
- [x] Create `users.controller.ts`
- [x] Create `users.service.ts`
- [x] Create `user.entity.ts`
- [x] Create create/update user DTOs
- [x] Add basic user response DTO
- [x] Add `Role` enum
- [x] Add `isActive`
- [x] Add `isManager`
- [x] Add timestamps
- [x] Add soft delete column if needed
- [x] Add methods to find user by id/email
- [x] Add basic user profile route

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

Status: Done

Goal:

Implement basic authentication using JWT access token.

Tasks:

- [x] Create `auth.module.ts`
- [x] Create `auth.controller.ts`
- [x] Create `auth.service.ts`
- [x] Create login DTO
- [x] Create register DTO
- [x] Add password hashing utility/service
- [x] Add JWT payload interface
- [x] Add JWT strategy
- [x] Add JWT auth guard
- [x] Add `@Public()` decorator
- [x] Add `@CurrentUser()` decorator
- [x] Add `/auth/register`
- [x] Add `/auth/login`
- [x] Add `/auth/me`
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

Status: Done

Goal:

Add authorization capabilities for role-based access and manager-only access.

Tasks:

- [x] Add metadata constants
- [x] Add `@Roles()` decorator
- [x] Add `RolesGuard`
- [x] Add `@ManagerOnly()` decorator
- [x] Add `ManagerGuard`
- [x] Protect manager/admin routes
- [x] Ensure only users with `isManager = true` can access `/admin` routes
- [x] Prepare `@Permissions()` decorator placeholder for future permission system
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

Status: Done

Goal:

Create a clean admin route scope.

Tasks:

- [x] Create `admin.module.ts`
- [x] Create `admin.controller.ts`
- [x] Create `admin.service.ts`
- [x] Prefix admin routes with `/admin`
- [x] Apply manager-only access
- [x] Add basic admin health/dashboard route

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

Status: Done

Goal:

Add Swagger API documentation.

Tasks:

- [x] Add Swagger config
- [x] Add Swagger setup in `core/swagger`
- [x] Add auth bearer documentation
- [x] Add tags for Auth, Users, Admin
- [x] Expose docs route

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

Status: Done

Goal:

Add refresh token support.

Tasks:

- [x] Add refresh token entity
- [x] Add refresh token DTO
- [x] Add refresh token rotation
- [x] Add logout
- [x] Add logout all devices
- [x] Store token metadata
- [x] Revoke old refresh tokens

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

Implementation notes:

```text
src/modules/auth/entities/refresh-token.entity.ts
src/modules/auth/enums/refresh-token-revoked-reason.enum.ts
src/modules/auth/refresh-token.service.ts
src/modules/auth/dto/refresh-token.dto.ts
src/modules/auth/dto/logout.dto.ts
src/modules/auth/types/refresh-token-payload.interface.ts
src/modules/auth/types/token-metadata.interface.ts
```

- Every login, register and refresh call stores one `refresh_tokens` row.
- Rotation happens inside a database transaction with a pessimistic row lock, so
  concurrent refreshes of the same token produce exactly one winner.
- The rotated-out token keeps a `replacedById` pointer, which forms the rotation chain.
- Replaying a token that was revoked by rotation is treated as theft: all sessions
  of that user are revoked. Tokens revoked by an explicit logout are not a
  compromise signal and do not trigger the sweep.
---

## Phase 8: Device Authentication

Status: Done

Goal:

Track authenticated devices.

Tasks:

- [x] Add user device entity
- [x] Store device info during login
- [x] List devices
- [x] Revoke device
- [x] Attach refresh tokens to devices

Expected routes:

```text
GET /auth/devices 
DELETE /auth/devices/:id
```

Expected commit:

```text
feat: add device authentication foundation
```

Implementation notes:

```text
src/modules/auth/entities/user-device.entity.ts
src/modules/auth/device.service.ts
src/modules/auth/dto/user-device.dto.ts
src/modules/auth/types/device-metadata.interface.ts
```

- Devices are fingerprinted by user agent, so repeated logins from the same
  browser or app reuse a single `user_devices` row instead of creating duplicates.
  Logging in again from a revoked device reactivates it instead of failing.
- Each `refresh_tokens` row carries a `deviceId`. Rotation keeps the token on its
  original device, so a session can never hop between devices while refreshing.
- `DELETE /auth/devices/:id` deactivates the device and revokes every refresh
  token attached to it (`device_revoked`).
- `logout-all` revokes all refresh tokens and deactivates all devices.
- The friendly device name is derived from the `user-agent` header by the
  `@DeviceName()` decorator, so clients never have to send anything. An explicit
  `x-device-name` header overrides it when a caller wants something friendlier
  than "Chrome on macOS". Both sources are untrusted, so the decorator trims the
  value, collapses whitespace and caps it at the column width.
- `parseUserAgent()` in `common/utils/user-agent.util.ts` is a dependency free
  best effort parser. It recognises the common browsers, the common operating
  systems, Android build models and API clients. Swap it for `ua-parser-js` if
  exhaustive coverage matters more than staying dependency free.

---
## Phase 9: Two-Factor Authentication

Status: Done

Goal:

Add optional 2FA support.

Tasks:

- [x] Add 2FA secret storage
- [x] Add 2FA setup endpoint
- [x] Add 2FA verify endpoint
- [x] Add 2FA login flow
- [x] Add recovery code support if needed

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

Implementation notes:

```text
src/modules/auth/entities/two-factor-secret.entity.ts
src/modules/auth/two-factor.service.ts
src/modules/auth/dto/two-factor-*.dto.ts
src/modules/auth/types/two-factor*.ts
src/common/utils/encryption.util.ts
src/common/utils/recovery-code.util.ts
src/configs/two-factor.config.ts
```

- TOTP via `otpauth`, QR codes via `qrcode`.
- The shared secret is never stored in the clear. It is encrypted with
  AES-256-GCM using `TWO_FACTOR_ENCRYPTION_KEY`, and the auth tag is verified on
  read so tampered rows fail loudly. Rotating the key invalidates every stored
  secret.
- `POST /auth/2fa/setup` issues a secret but does not activate 2FA.
  `POST /auth/2fa/verify` confirms it with a code and only then enables 2FA and
  returns the recovery codes, which are shown once.
- Recovery codes are Crockford style base32, stored as salted hashes and removed
  from the list as they are spent, so the array doubles as the set still usable.
- `POST /auth/login` returns HTTP 200 with a short lived challenge token instead
  of tokens when 2FA is on. `POST /auth/2fa/login` exchanges the challenge plus
  a TOTP code or a recovery code for the token pair.
- TOTP steps are single use. The last accepted counter is persisted, so replaying
  a code inside its own 30 second window is rejected.
- Five invalid attempts locks verification for 15 minutes. Rate limiting on the
  routes themselves is still tracked in Phase 11.
- Setting `TWO_FACTOR_ENABLED=false` turns the feature off globally, and login
  falls back to the single factor flow.

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
| Phase 0 | Project Architecture Skeleton | Done |
| Phase 1 | Base Application Foundation | Done |
| Phase 2 | Users Module | Done |
| Phase 3 | Auth Module - Basic JWT | Done |
| Phase 4 | Authorization - RBAC and Manager Scope | Done |
| Phase 5 | Admin Module Foundation | Done |
| Phase 6 | API Documentation | Done |
| Phase 7 | Refresh Tokens | Done |
| Phase 8 | Device Authentication | Done |
| Phase 9 | Two-Factor Authentication | Done |
| Phase 10 | Cache and Performance | Pending |
| Phase 11 | Production Hardening | Pending |