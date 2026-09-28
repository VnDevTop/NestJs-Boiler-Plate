<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>
<p align="center">
  <a href="https://github.com/VnDevTop/NestJs-Boiler-Plate"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://github.com/VnDevTop/NestJs-Boiler-Plate"><img src="https://img.shields.io/badge/node-%3E%3D22-5FA04E" alt="Node 22+" /></a>
  <a href="https://github.com/VnDevTop/NestJs-Boiler-Plate/actions"><img src="https://img.shields.io/badge/CI-passing-brightgreen" alt="CI" /></a>
</p>

# NestJS Boilerplate

A production-ready NestJS template for APIs that need authentication done
properly. The session handling, the authorisation and the deployment defaults are
already built and explained, so a new project starts from working code instead of
a scaffold.

Deliberately not a framework: there is no string of configuration objects, no
opinion on your domain, and no folder you have to fight. What is here is the
part that every real API needs and that is tedious to get right, and nothing
else.

## What is inside

**Sessions that behave correctly under attack**

- JWT access token with a rotating refresh token pair.
- Rotation inside a transaction with a row lock, so concurrent refreshes produce
  exactly one winner rather than two sessions.
- Replaying a token that was rotated out is treated as theft and revokes every
  session of that user. Logging out is not a compromise signal and does not.
- Devices fingerprinted by user agent, so logging in twice from one browser does
  not create two device rows, and revoking a device revokes its tokens.
- Optional TOTP two-factor, secret encrypted at rest, single use steps, and
  recovery codes shown once.

**Authorisation you can reason about**

- `@Roles()`, `@ManagerOnly()` and a `@Permissions()` placeholder.
- Guards read the request context instead of loading services, so an
  authorisation failure reads the same as any other failure.
- The admin scope is guarded at the controller, which makes a new route there
  protected by default.

**Platform decisions already made**

- Configuration is namespaced and typed, and the whole environment is validated
  before anything connects. A missing secret is one clear error at boot, not a
  failure twenty minutes later.
- Redis or Valkey cache with request coalescing and stale while revalidate, so a
  hot key expiring under load does not stampede the database.
- Rate limiting globally, tightened on the routes that accept a password or a
  six digit code.
- Request id on every response, and JSON logs in production that carry it.
- Liveness and readiness probes kept separate, so a database problem does not make
  an orchestrator restart every healthy instance.
- Migrations with `synchronize` off, an idempotent seed, graceful shutdown, a
  two stage Docker image and a local docker-compose stack.

## Stack

|            |                                                                   |
| ---------- | ----------------------------------------------------------------- |
| Framework  | NestJS 12, Express 5, Node 22+                                    |
| Language   | TypeScript, ESM, NodeNext                                         |
| Data       | PostgreSQL, TypeORM, reviewed migrations                          |
| Cache      | Redis or Valkey via `@nestjs/cache-manager`, Keyv                 |
| Auth       | JWT access and refresh tokens, TOTP 2FA                           |
| Validation | `zod` for the environment, `class-validator` for requests         |
| Docs       | Swagger at `/docs`                                                |
| Ops        | helmet, throttler, terminus health checks, Docker, GitHub Actions |

Runs on Express and on Fastify. The middleware declares the parts of the request
and reply it uses, and picks its catch-all route per adapter, because the two
routers spell a wildcard differently.

## Quick start

### With Docker

```bash
git clone https://github.com/VnDevTop/NestJs-Boiler-Plate.git
cd NestJs-Boiler-Plate
cp .env.example .env
docker compose up --build
```

Brings up Postgres and Valkey, runs the migrations, then starts the app. The
admin user is seeded and its password is printed once, at first start.

- API on `http://localhost:3000/api/v1`
- Docs on `http://localhost:3000/docs`

### Without Docker

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and CACHE_URL
npm run migration:run
npm run seed                   # prints a generated admin password
npm run start:dev
```

## Scripts

```bash
npm run start:dev            # watch mode
npm run build                # compile
npm run start:prod           # run the compiled build
npm run lint                 # oxlint
npm run typecheck            # tsc --noEmit
npm test                     # vitest
npm run check                # all four, in the order CI runs them
npm run migration:generate   # write a migration from entity changes
npm run migration:run
npm run migration:revert
npm run seed
```

## Project structure

```text
src
├── configs      namespaced, typed configuration and environment validation
├── database     migrations, seeds, the standalone data source
├── common       guards, decorators, middleware, utilities
├── core         cache, health, logger, swagger
└── modules      auth, users, admin
```

Business features live in `modules`, each documenting itself. Technical
capabilities live in `core`. Anything reusable across features lives in `common`,
and nothing in `common` may know what your business does.

## Documentation

Each folder documents itself, so an explanation sits where you are already
looking.

|                                                  |                                                           |
| ------------------------------------------------ | --------------------------------------------------------- |
| [PLAN.md](PLAN.md)                               | the phases, their status, and what is still open          |
| [ROADMAP.md](ROADMAP.md)                         | what is shipped, open decisions, and enhancement plans    |
| [CHANGELOG.md](CHANGELOG.md)                     | what each change did and why, per commit                  |
| [docs/production.md](docs/production.md)         | rate limiting, headers, CORS, logging, health, Docker, CI |
| [src/configs](src/configs/README.md)             | configuration namespaces and environment validation       |
| [src/database](src/database/README.md)           | migrations, seeds, the standalone data source             |
| [src/common](src/common/README.md)               | guards, decorators, middleware, utilities                 |
| [src/core](src/core/README.md)                   | technical capabilities                                    |
| [src/core/cache](src/core/cache/README.md)       | coalescing, stale while revalidate, invalidation          |
| [src/core/health](src/core/health/README.md)     | liveness vs readiness                                     |
| [src/core/logger](src/core/logger/README.md)     | development colours vs production JSON                    |
| [src/modules](src/modules/README.md)             | module rules and the full route list                      |
| [src/modules/auth](src/modules/auth/README.md)   | sessions, rotation, devices, two-factor                   |
| [src/modules/users](src/modules/users/README.md) | the user domain and its authorisation                     |
| [src/modules/admin](src/modules/admin/README.md) | operator-only routes                                      |

## Known limitations

Recorded rather than left to be discovered. See
[ROADMAP.md](ROADMAP.md#open-decisions) for the reasoning, and
[SECURITY.md](SECURITY.md) for what to check before a real deployment.

- Rate limits are counted per process, so the effective limit is the configured
  one multiplied by the number of replicas.
- `GET /users/:id` has no role guard: any authenticated user can read another
  user's profile, email included. The password hash is withheld.
- Listing routes return every matching row, with no pagination yet.
- A dead cache costs latency rather than correctness. Each request waits out
  `CACHE_CONNECT_TIMEOUT` for the failed read and again for the failed write.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commit messages follow Conventional
Commits and are checked before the commit is created.

## License

[MIT](LICENSE) © VnDevTop
