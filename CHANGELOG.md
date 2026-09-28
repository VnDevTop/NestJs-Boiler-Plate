# Changelog

Every notable change, newest first, in the order it happened. Entries are grouped
by the commit that made them, carry the task list from the phase that produced
them, and hold the implementation detail that used to live in
[PLAN.md](PLAN.md) before it moved next to the code.

This is a boilerplate, so there is no release history to version. It starts at
`0.0.1` and whatever you build on top of it is yours to version as you see fit.
What matters here is being able to read what a change did and why, without
reading the diff.

The current documentation, describing how the code behaves now, lives next to the
code itself. This file is the record of how it got that way.

---

## docs: licence, contributor and security documentation

Intended commit: `docs: add licence, contributing guide, security policy and roadmap`

**Tasks**

- [x] Add a licence
- [x] Add a contributing guide
- [x] Add a security policy
- [x] Add a roadmap with enhancement plans
- [x] Add this changelog, written per commit
- [x] Rewrite the README to introduce the project

- `LICENSE` is MIT. The boilerplate is meant to be forked and used, and a licence
  that discourages that makes the whole exercise pointless.
- `SECURITY.md` records what is in scope and where to report privately, and lists
  the known limitations that matter for a real deployment: per process rate
  limits, the unguarded `GET /users/:id`, the two-factor key that has a default,
  and the compose stack that uses development secrets.
- `ROADMAP.md` separates the three open decisions from the enhancement plans, so
  an undecided question is not read as a feature that already exists. Each plan
  carries what it would cost, and the ones that are cheap to get wrong, such as
  caching authorisation claims or deleting a large table in one statement, say so
  at the point where someone would otherwise just do it.
- The README is rewritten to introduce the project rather than to describe the
  Nest starter it replaced, and it links to the folder readmes so an explanation
  is where you are already looking.

## test: build the platform app per branch so the types resolve

**Tasks**

- [x] Make the cross platform middleware spec type check

**Files**

```text
src/common/middlewares/request-id.middleware.spec.ts
```

- The cross platform middleware test built its application with
  `{ adapter: useFastify ? new FastifyAdapter() : undefined }`, which is a union
  the two `NestFactory.create` overloads both reject, so the spec file did not
  type check even though the tests passed.
- Each branch now calls `create` with the shape that branch actually uses. A test
  that runs but does not compile is a broken test: it stops anyone running
  `npm run typecheck`, which is one of the four checks CI performs.

## chore: enforce commit messages and staged formatting with husky

**Tasks**

- [x] Add husky
- [x] Add commitlint
- [x] Add lint-staged
- [x] Add a commit convention check
- [x] Add a staged formatting check
- [x] Add a `check` script running the same steps as CI
- [x] Record `license`, `author`, `repository`, `engines` and `packageManager`
- [x] Add a description and keywords for the package

**Files**

```text
.husky/commit-msg
.husky/pre-commit
commitlint.config.mjs
package.json
package-lock.json
.gitignore
```

- husky writes to `.husky/_`, which is gitignored. `npm install` restores the
  hooks through the `prepare` script, so a fresh clone has them without a manual
  step.
- commitlint follows Conventional Commits, with the subject pinned to lower case
  so the history keeps the style it already has instead of each message choosing
  its own. A malformed message fails the commit rather than waiting for CI.
- lint-staged runs Prettier and `oxlint --fix` on staged files only, so a commit
  never reformats work that is not part of it.
- `npm run check` runs the four steps CI runs, in the same order, so the whole
  gate is available locally in one command.
- `package.json` was `UNLICENSED` with an empty description and no repository, so
  a published package of this template would have said nothing about where it
  came from or what it was.

## docs: move implementation notes from the plan into folder readmes

**Tasks**

- [x] Remove implementation notes from `PLAN.md`
- [x] Add a README to `src/configs`
- [x] Add a README to `src/database`
- [x] Add a README to `src/common`
- [x] Add a README to `src/core`
- [x] Add a README to `src/core/health`
- [x] Add a README to `src/core/logger`
- [x] Add a README to `src/core/swagger`
- [x] Add a README to `src/modules`
- [x] Add a README to `src/modules/auth`
- [x] Add a README to `src/modules/users`
- [x] Add a README to `src/modules/admin`
- [x] Point `PLAN.md` at the readmes

- The implementation notes were removed from `PLAN.md`, which now holds only the
  phases, their status, the progress table and the follow-up candidates.
- The previous layer readmes listed files that do not exist: `redis.config.ts`,
  `RequestIdInterceptor`, `TimeoutInterceptor`, and the `exceptions` and
  `serializers` directories. All of that was aspirational and misleading, and it
  is now either real or gone.
- Two previously invisible decisions are recorded rather than implied: rate limits
  are counted per replica, and `GET /users/:id` is readable by any authenticated
  user.

## chore: add production hardening foundation

**Tasks**

- [x] Add rate limiting
- [x] Add security headers
- [x] Add CORS config
- [x] Add request id
- [x] Add structured logging
- [x] Add health check
- [x] Add graceful shutdown
- [x] Add environment validation
- [x] Add seed command
- [x] Add migration command
- [x] Add CI workflow
- [x] Add Dockerfile
- [x] Add docker-compose for local development

**Files**

```text
src/configs/security.config.ts
src/configs/cors.config.ts
src/configs/throttler.config.ts
src/configs/env.validation.ts
src/common/middlewares/request-id.middleware.ts
src/common/middlewares/catch-all-route.util.ts
src/common/utils/request-id.util.ts
src/core/logger/app.logger.ts
src/core/health/health.module.ts
src/core/health/cache.health.ts
src/core/health/shutdown.service.ts
src/database/data-source.ts
src/database/seed.ts
src/database/seeds/
src/database/migrations/
docs/production.md
Dockerfile
docker-compose.yml
.github/workflows/ci.yml
```

- Rate limiting is a global `ThrottlerGuard`, so a new endpoint is limited from
  the moment it exists. The credential routes override it with `@Throttle`,
  because 100 per minute is no defence at all for a route that accepts a
  password: login is 5 per minute, the TOTP routes 5 per 5 minutes, since a six
  digit code is 1 in a million. Counters are in process memory, so with several
  replicas the limit is per replica.
- CORS defaults to same-origin only and `credentials` to false, since this API
  authenticates with a bearer token rather than a cookie. Validation rejects
  `CORS_CREDENTIALS=true` together with a wildcard, because browsers refuse that
  pairing anyway and a config that only appears to work is worse than one that
  fails.
- A request id is reused from the client only when it is 8 to 64 characters of a
  restricted charset. The id lives in an `AsyncLocalStorage`, so logs from deep
  inside a service correlate without the call site knowing about requests.
  Measured with a raw socket, Node's HTTP parser rejects a newline in a header
  with a 400 before any handler runs, so the charset rule is defence in depth
  rather than the thing standing between a caller and a forged log line.
- The middleware is platform independent. `header()` is the one spelling both
  Express and Fastify have, and `catchAllRoute` picks the wildcard per adapter,
  because `path-to-regexp` v8 and `find-my-way` spell a catch-all differently and
  neither accepts the other's. Tested on both adapters with a real HTTP server.
- Logging is one JSON object per line in production, with the request id
  included when there is one. Development keeps Nest's own logger, which is
  coloured and prints how long each module took to initialise, and that number is
  lost the moment output becomes JSON.
- Health checks are split into liveness and readiness. Liveness touches nothing
  external, because a failing liveness probe makes an orchestrator restart every
  healthy instance at the exact moment a dependency is down.
- The cache health check writes a random value and reads it back. A plain read
  would report healthy on a dead cache, which is the same trap that made
  `CacheService.isHealthy()` impossible.
- Environment validation reports every problem at once. It is strict in
  production, where a secret that still holds the `.env.example` value counts as
  unset, and lenient in development so a placeholder does not block local work.
  The schema is `zod`; its own messages are kept, and messages are written only
  for the `refine` checks where zod would otherwise say nothing useful.
- `synchronize` is off and schema changes go through reviewed migrations.
  Entities are listed explicitly in the standalone data source, since
  `autoLoadEntities` only works inside the Nest container and a migration that
  missed an entity would silently generate an incomplete schema.
- The seed creates one admin and is idempotent. With no `ADMIN_PASSWORD` it
  generates a 24 character password and prints it once, and checks for an
  existing admin before generating anything, so a second run stays silent rather
  than printing a password that will not work.
- The Docker image is a two stage build running as the `node` user, and its
  healthcheck uses the liveness endpoint so a database problem cannot get the
  container restarted.

## feat: add redis cache foundation

**Tasks**

- [x] Add Redis config
- [x] Add cache module
- [x] Add cache service abstraction
- [x] Add cache key constants
- [x] Add cache decorators/helpers if needed

**Files**

```text
src/configs/cache.config.ts
src/core/cache/cache.module.ts
src/core/cache/cache.service.ts
src/core/cache/cache-keys.ts
```

- Uses `@nestjs/cache-manager` with Keyv, and `@keyv/redis` for Redis and
  Valkey. Both talk the same protocol, so only `backend` differs between them.
  `CACHE_URL` is the whole connection configuration, including credentials, TLS
  and database, which is what the Redis client takes anyway.
- Exactly one store. `CACHE_BACKEND=memory` is an explicit choice for local
  development, never a silent fallback, so a configured but unreachable cache
  fails the boot instead of quietly serving per-instance data. The two store
  layout that `@nestjs/cache-manager` documents was rejected after measurement:
  memory first means the shared store is written but never read, and Redis first
  with a memory fallback resurrects values that were just deleted, because the
  delete only reached the shared store.
- An unreachable cache fails the boot, through a `store.get('__startup__')` probe
  with `throwOnErrors` on, since a Keyv store connects lazily and the app would
  otherwise start and fail on the first request. Errors are switched off after
  the probe so a later outage is a miss rather than a 500.
- `CacheService.wrap()` is the miss handler and the failover back to the
  database. It delegates to cache-manager, which already supplies request
  coalescing and stale while revalidate, so neither is reimplemented here.
  Measured on Valkey: 300 concurrent requests on one hot key cause 1 loader call;
  a read inside the refresh threshold returns in 80ms while the loader takes
  200ms, and the refreshed value appears afterwards.
- Nullish results are cached for `CACHE_EMPTY_TTL` rather than the full TTL, so
  repeated lookups of something missing stop hammering the loader while a record
  created afterwards still appears quickly. This does not help a client
  enumerating many different missing ids, since each is a separate key.
- Expirations carry a 10% jitter, so a bulk write does not put every entry on
  the same deadline and expire them in one burst.
- `disableOfflineQueue` is set on the client, so a command issued while the
  socket is reconnecting reports a miss instead of waiting for the outage to end.
  It does not remove the cost of a dead cache: the store re-attempts the
  connection on every operation, and each attempt waits out
  `CACHE_CONNECT_TIMEOUT`. Measured against an unreachable cache with the default
  2000ms, one request costs 4003ms, because the read misses and the write back
  fails. Concurrent requests for the same key still share a single loader run, so
  the outage costs latency rather than correctness.
- Invalidation is by explicit key only. There is no `deleteByPattern`, because
  scanning a keyspace is unbounded on a shared server and a broad pattern fails
  silently.
- Authentication state is not cached, so a role change or a deactivation takes
  effect on the next request instead of after a TTL.

## feat: add two-factor authentication foundation

**Tasks**

- [x] Add 2FA secret storage
- [x] Add 2FA setup endpoint
- [x] Add 2FA verify endpoint
- [x] Add 2FA login flow
- [x] Add recovery code support if needed

**Files**

```text
src/modules/auth/entities/two-factor-secret.entity.ts
src/modules/auth/two-factor.service.ts
src/modules/auth/dto/two-factor-*.dto.ts
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
- Five invalid attempts locks verification for 15 minutes.
- Setting `TWO_FACTOR_ENABLED=false` turns the feature off globally, and login
  falls back to the single factor flow.

## feat: add device authentication foundation

**Tasks**

- [x] Add user device entity
- [x] Store device info during login
- [x] List devices
- [x] Revoke device
- [x] Attach refresh tokens to devices

**Files**

```text
src/modules/auth/entities/user-device.entity.ts
src/modules/auth/device.service.ts
src/modules/auth/dto/user-device.dto.ts
src/modules/auth/types/device-metadata.interface.ts
```

- Devices are fingerprinted by user agent, so repeated logins from the same
  browser or app reuse a single `user_devices` row instead of creating
  duplicates. Logging in again from a revoked device reactivates it instead of
  failing.
- Each `refresh_tokens` row carries a `deviceId`. Rotation keeps the token on its
  original device, so a session can never hop between devices while refreshing.
- `DELETE /auth/devices/:id` deactivates the device and revokes every refresh
  token attached to it (`device_revoked`).
- `logout-all` revokes all refresh tokens and deactivates all devices.
- The friendly device name is derived from the `user-agent` header by the
  `@DeviceName()` decorator, so clients never have to send anything. An explicit
  `x-device-name` header overrides it. Both sources are untrusted, so the
  decorator trims the value, collapses whitespace and caps it at the column
  width.
- `parseUserAgent()` in `common/utils/user-agent.util.ts` is a dependency free
  best effort parser. Swap it for `ua-parser-js` if exhaustive coverage matters
  more than staying dependency free.

## feat: add refresh token authentication

**Tasks**

- [x] Add refresh token entity
- [x] Add refresh token DTO
- [x] Add refresh token rotation
- [x] Add logout
- [x] Add logout all devices
- [x] Store token metadata
- [x] Revoke old refresh tokens

**Files**

```text
src/modules/auth/entities/refresh-token.entity.ts
src/modules/auth/enums/refresh-token-revoked-reason.enum.ts
src/modules/auth/refresh-token.service.ts
```

- Every login, register and refresh call stores one `refresh_tokens` row.
- Rotation happens inside a database transaction with a pessimistic row lock, so
  concurrent refreshes of the same token produce exactly one winner.
- The rotated-out token keeps a `replacedById` pointer, which forms the rotation
  chain.
- Replaying a token that was revoked by rotation is treated as theft: all
  sessions of that user are revoked. Tokens revoked by an explicit logout are not
  a compromise signal and do not trigger the sweep.

## feat: integrate Swagger for API documentation

**Tasks**

- [x] Add Swagger config
- [x] Add Swagger setup in `core/swagger`
- [x] Add auth bearer documentation
- [x] Add tags for Auth, Users, Admin
- [x] Expose docs route

- `GET /docs`, with bearer authentication documented, and tags for Auth, Users
  and Admin.
- Each endpoint declares a response DTO, so the schema is declared rather than
  inferred. `POST /auth/login` returns either tokens or a two-factor challenge,
  which is spelled out with `oneOf` in `@ApiExtraModels`.
- Content-Security-Policy is off by default, because the Swagger UI needs inline
  script and style and a strict policy blocks it.

## feat: add admin health check and enhance dashboard functionality

**Tasks**

- [x] Create `admin.module.ts`
- [x] Create `admin.controller.ts`
- [x] Create `admin.service.ts`
- [x] Prefix admin routes with `/admin`
- [x] Apply manager-only access
- [x] Add basic admin health/dashboard route

- `GET /admin/health` and `GET /admin/dashboard`, both behind `@ManagerOnly()`
  on the controller so a new route there is protected by default.

## feat: implement role-based access control (RBAC) and manager scope handling

**Tasks**

- [x] Add metadata constants
- [x] Add `@Roles()` decorator
- [x] Add `RolesGuard`
- [x] Add `@ManagerOnly()` decorator
- [x] Add `ManagerGuard`
- [x] Protect manager/admin routes
- [x] Ensure only users with `isManager = true` can access `/admin` routes
- [x] Prepare `@Permissions()` decorator placeholder for future permission system

- `@Roles()` with a global `RolesGuard`, `@ManagerOnly()` with a `ManagerGuard`,
  and `@Permissions()` prepared for a finer permission system.
- The guards read the request context rather than injecting a feature service, so
  an authorisation failure reads the same as any other failure.

## feat: implement authentication module with JWT support

**Tasks**

- [x] Create `auth.module.ts`
- [x] Create `auth.controller.ts`
- [x] Create `auth.service.ts`
- [x] Add login DTO
- [x] Add register DTO
- [x] Add password hashing utility/service
- [x] Add JWT payload interface
- [x] Add JWT strategy
- [x] Add JWT auth guard
- [x] Add `@Public()` decorator
- [x] Add `@CurrentUser()` decorator
- [x] Add `/auth/register`
- [x] Add `/auth/login`
- [x] Add `/auth/me`

- Access token signing, scrypt password hashing with a per-row salt, and the
  `JwtStrategy` behind a global `JwtAuthGuard` with `@Public()` as the opt out.
- `UserResponseDto` has no property for the password, so a response cannot leak
  it even by accident.

## feat: implement user management module foundation

**Tasks**

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

- `User` entity with a uuid from the database, a unique lower cased email,
  `isActive` and `isManager` kept separate, and a soft delete column.
- Create, read, update and soft delete, with admin only routes guarded by
  `@Roles(Admin, SuperAdmin)`.

## feat: enhance app configuration and introduce global utilities

**Tasks**

- [x] Define app config
- [x] Define JWT config placeholder
- [x] Organize existing database config
- [x] Add global validation pipe
- [x] Add global exception filter
- [x] Add global response transform interceptor
- [x] Add common metadata constants
- [x] Add base response DTO/interface
- [x] Add request context interface

- Namespaced configuration through `registerAs`, and the global validation pipe,
  exception filters and response transform interceptor.

## chore: initialize project structure with placeholders and documentation

**Tasks**

- [x] Create `src/configs`
- [x] Create `src/database`
- [x] Create `src/common`
- [x] Create `src/core`
- [x] Create `src/modules`
- [x] Add README for each main layer
- [x] Add root `PLAN.md`
- [x] Commit architecture skeleton

- The layer structure, and the rule that `common` may not depend on business
  modules.

## Add initial database and Observe configuration setup

- `DATABASE_URL` based connection, and the optional observability integration.

## Initialize NestJS boilerplate with basic setup

- Nest 12 on Express 5, ESM with NodeNext, Prettier, oxlint and vitest.
