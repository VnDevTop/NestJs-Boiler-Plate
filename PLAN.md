# NestJS Boilerplate Implementation Plan

## Goal

Extend the boilerplate from a correct auth skeleton to something a real product
can run on: users get contacted, the database stops growing on its own,
authentication is served from cache, and the app can tell the operator what it
is doing.

The layer boundaries are unchanged. Everything below slots into `configs`,
`database`, `common`, `core` and `modules` as they exist today.

Already built, not rebuilt here:

- JWT auth, refresh rotation, device authentication, two-factor
- RBAC with roles, permissions and manager scope
- `CacheService` with TTL, empty-TTL, coalescing and invalidation helpers
- helmet, CORS allow-list, throttler, Swagger, Observe, Terminus health
- TypeORM migrations, oxlint, vitest, husky, commitlint

Gaps this plan closes:

- Nothing ever emails a user, and there is no password reset or verification.
- Soft-deleted rows and dead tokens accumulate with no retention policy.
- `CacheService` exists but no service reads or invalidates it, so every
  request still goes to Postgres.
- No outbound notification channel, and no visibility into what the app sends.

---

## Phase 12: Optional Integration Foundation

Status: Done

Goal:

Allow an integration to exist in the code without its package existing on disk.
A feature nobody enabled must cost zero dependencies and zero memory.

Tasks:

- [x] Create `src/core/optional/optional.util.ts` with `loadOptional<T>(specifier)`
      using `createRequire(import.meta.url)`
- [x] Never use a static `import` for an optional package; a static import
      breaks the build when the package is missing
- [x] Register every optional integration through a `useFactory` that returns
      `null` when the package is not resolvable
- [x] Make `null` a real, tested code path in every consumer, not a `throw`
- [x] Write the in-house, zero-dependency transports that the default profile
      uses (mail memory transport, Telegram and Slack over raw HTTPS)
- [x] Add `docs/optional-integrations.md`: feature, package, env flag, install command

Integration matrix:

```text
Feature                 Package to install (only if enabled)   Env flag
SMTP (production mail)   nodemailer                            MAIL_TRANSPORT=smtp
Amazon SES              @aws-sdk/client-sesv2                 MAIL_TRANSPORT=ses
SendGrid                @sendgrid/mail                        MAIL_TRANSPORT=sendgrid
BullMQ queue            @nestjs/bullmq + bullmq               QUEUE_ENABLED=true
Telegram                none, raw HTTPS                       TELEGRAM_ENABLED=true
Slack / Discord         none, incoming webhook                SLACK_ENABLED=true
```

Implementation note:

```ts
import { createRequire } from 'node:module';

const requireOptional = createRequire(import.meta.url);

export function loadOptional<T>(specifier: string): T | null {
  try {
    return requireOptional(specifier) as T;
  } catch {
    return null;
  }
}
```

Expected outcome:

- The app boots, passes tests and serves traffic with an empty
  `optionalDependencies`, degrading cleanly instead of crashing.
- Enabling a feature is a documented `npm install` plus an env flag.

Expected commit:

```text
feat: add optional integration foundation
```

---

## Phase 13: Configuration Expansion

Status: Done

Goal:

Add the configuration namespaces the new modules need, with the same
`registerAs` pattern, zod validation and `.env.example` entries the existing
namespaces already have.

Tasks:

- [x] Create `src/configs/mail.config.ts` — transport, from name, reply-to,
      connection options, timeouts
- [x] Create `src/configs/notification.config.ts` — per-channel enable flags
      and credentials
- [x] Create `src/configs/queue.config.ts` — enabled, redis url, attempts,
      backoff, concurrency
- [x] Create `src/configs/retention.config.ts` — every age and batch size
- [x] Create `src/configs/password-policy.config.ts`
- [x] Add `APP_URL` to `app.config.ts`; every email links back to it
- [x] Add a `redis` namespace for queue and throttle usage, distinct from the
      cache namespace so keys never collide
- [x] Extend `env.validation.ts`: in production `MAIL_FROM` is required,
      `MAIL_TRANSPORT` must not be `memory`, `APP_URL` must be an absolute
      https URL
- [x] Document every new variable in `.env.example` and `src/configs/README.md`

Implementation note: a validation rule that only fires in production is
`superRefine` on the zod schema, not a check inside the service, so a bad
deploy fails at boot instead of at the first email.

Expected outcome:

- No hard-coded value anywhere in the new modules.
- A misconfigured production environment is rejected at startup with a message
  naming the variable.

Expected commit:

```text
feat: add mail, notification, queue and retention configuration
```

---

## Phase 14: Outbound Email

Status: Pending

Goal:

Deliver transactional email through a swappable transport, with templates
written as plain functions so no template engine dependency is introduced.

Note: templates are deliberately plain functions in this phase, and the ones
shipped in the repository are the only ones that can send. A template engine and
database-managed templates are a separate phase, Phase 22, because they are a
runtime dependency and an admin surface, and neither belongs in the phase whose
job is to make a user receive a welcome email.

Tasks:

- [ ] Create `src/modules/mail` with `mail.module.ts`, `mail.service.ts`
- [ ] Define `MailTransport { send(message): Promise<SendResult> }` in
      `transports/transport.interface.ts`
- [ ] Implement `memory.transport.ts` as the zero-dependency dev default
- [ ] Implement `smtp.transport.ts` over the optional `nodemailer`
- [ ] Implement `ses.transport.ts` and `sendgrid.transport.ts` over their
      optional packages
- [ ] Make `memory` the development default and refuse it in production
- [x] Build `templates/template.registry.ts` mapping a name to
      `{ subject, render(data) }`
- [x] Render both an HTML and a plain-text part for every template
- [x] Give each template exactly the data it needs, never the user entity
- [ ] Generate a stable mail id per message, log it, and return it to the caller
- [ ] Add `POST /auth/forgot-password`, returning 202 with a generic message
- [ ] Add `POST /auth/reset-password`, single-use token, invalidates other
      sessions on success
- [ ] Add `POST /auth/verify-email` and `POST /auth/resend-verification`
- [ ] Add the `email_verification_tokens` and `password_reset_tokens` entities
- [ ] Store tokens hashed with sha256, never in plaintext
- [ ] Index `expiresAt` on every token table, Phase 16 cleans on it
- [ ] Add a throttler bucket for mail: 3 reset mails per hour per email and
      10 per hour per IP

Template set:

```text
welcome            after register            firstName, appName
verify-email       after register / resend   verificationUrl, expiresInHours
reset-password     forgot password           resetUrl, ip, expiresInMinutes
password-changed   after reset, forced      ip, deviceLabel
new-device-login   refresh from new device   deviceLabel, ip, time
account-locked     lockout or admin action   reason, supportUrl
```

Security notes that are part of the definition of done:

- `forgot-password` answers identically, with comparable timing, whether or not
  the email exists.
- The reset token is consumed inside the same transaction that changes the
  password, so a crash can never leave a live token with a changed password.
- `MailService.send()` must not add latency to `register()` or `login()`; it
  resolves as soon as the job is accepted.

Expected outcome:

- A new user receives a welcome email, can verify their address, and can reset
  a forgotten password.
- A provider outage degrades to a logged error, never a 500 on register.

Expected commit:

```text
feat: add transactional email with pluggable transports
```

---

## Phase 15: Background Job Queue

Status: Pending

Goal:

Move email sending and notifications out of the request cycle, and give the
retention job a scheduler.

Tasks:

- [ ] Add `@nestjs/bullmq` as an optional dependency, resolved through
      `loadOptional`, not a static import
- [ ] Create `src/modules/queue` with a provider-level abstraction over the
      queue so the module imports cleanly when the package is absent
- [ ] Create queues: `mail`, `notification`, `maintenance`, `digest`
- [ ] Move the mail send from Phase 14 into `processors/mail.processor.ts`
- [ ] Add `retry.policy.ts`: exponential backoff, 5 attempts
- [ ] Mark provider 4xx responses as non-retryable, retry only timeouts, 5xx
      and connection errors
- [ ] Send exhausted jobs to a dead-letter list in Redis and raise a log alarm
- [ ] Add an in-process fallback: when the queue is disabled or Redis is
      unreachable, run the same processor under a bounded concurrency limiter
- [ ] Add an idempotency guard, `template + recipient + subject id`, using a
      Redis `SET NX` with a TTL matching the retry window
- [ ] Register the cron entry points, disabling them with `QUEUE_ENABLED=false`

Implementation note: the fallback must call the same processor function as the
queue does, so there is one implementation of the work and not two that drift.

Expected outcome:

- `register()` returns without waiting for SMTP.
- A BullMQ redelivery cannot produce a duplicate welcome email.
- Turning the queue off is a config change, not a code change.

Expected commit:

```text
feat: add background job queue with in-process fallback
```

---

## Phase 16: Data Retention and Cleanup

Status: Pending

Goal:

Bound the size of the database by deleting data that can no longer be useful,
without ever taking a lock that hurts production traffic.

Tasks:

- [ ] Create `src/modules/maintenance` with a `retention.service.ts`
- [ ] Implement the policy below, every age configurable
- [ ] Add a `maintenance.retention` cron at an off-peak hour, plus an
      admin-triggered manual run
- [ ] Delete in batches with `WHERE id IN (SELECT id ... LIMIT 5000)` and a
      sleep between batches
- [ ] Log a structured summary of rows deleted per target, and expose the last
      run time and duration
- [ ] Add `RETENTION_DRY_RUN` that reports what would be deleted and deletes
      nothing
- [ ] Add a hard-coded minimum age guard, so a misconfigured value cannot
      delete fresh data
- [ ] Add the `maintenance.log` entity, append-only, to record each run
- [ ] Add an admin route to trigger a dry run and to read the history

Retention policy:

```text
Target                        Rule                                    Default
users (soft deleted)          hard delete after deletedAt + N days     30
email_verification_tokens     delete once expiresAt passed            +7 grace
password_reset_tokens         delete once used, or expiresAt + N      +7 grace
refresh_tokens                delete when revokedAt + N, or expired   7
user_devices                  delete when no live refresh token       immediate
mail_logs, notification_logs  delete rows older than N                30
login attempt bookkeeping     delete rows older than N                7
two-factor secrets            cascade with the user delete             -
```

Expected outcome:

- Table sizes flatten out under normal traffic instead of growing forever.
- The first production run can be rehearsed safely with a dry run.

Expected commit:

```text
feat: add scheduled data retention and cleanup jobs
```

---

## Phase 17: Authentication and Authorization through Cache

Status: Pending

Goal:

Serve authentication from Redis instead of Postgres, while a revoked session or
a changed role still takes effect immediately rather than at TTL expiry.

Tasks:

- [ ] Add `wrapOrLoad()` to `CacheService`: read-through with a lock on the
      miss, so N concurrent requests do not trigger N queries
- [ ] Cache the sanitised user under `user:<id>`, TTL 60s
- [ ] Cache the email lookup under `user:email:<hash>`, TTL 300s
- [ ] Cache the permission set under `perm:user:<id>`, TTL 60s
- [ ] Cache the role permission map under `role:<role>`, TTL 600s
- [ ] Cache revoked token ids under `token:revoked:<jti>`, TTL equal to the
      remaining token lifetime
- [ ] Change `JwtStrategy.validate()` to read through the cache instead of
      querying the user table
- [ ] Change `PermissionsGuard` to read the cached permission set instead of
      querying per request
- [ ] Invalidate on every write to `User`, `Role` and device state
- [ ] Do the invalidation from a TypeORM subscriber in
      `src/database/subscribers/`, not from each service, so it cannot be
      forgotten in one of them
- [ ] Add negative caching for lookups that miss, using the existing
      `CACHE_EMPTY_TTL`
- [ ] Wrap the cache so a Redis timeout falls back to the database and only
      logs
- [ ] Add a throttler key for login, two-factor and refresh, per IP and per
      email, backed by Redis so limits hold across replicas
- [ ] Replace the hard block on login with a progressive delay, so credential
      stuffing is slowed without locking out a real user
- [ ] Add `sessionsVersion` on the user, bumped on logout-everywhere, and
      checked in the strategy so all access tokens die immediately
- [ ] Add `GET /auth/sessions` and `DELETE /auth/sessions/:id`
- [ ] Extend the Terminus health indicator to report cache loss as degraded
      rather than down

Implementation note: a stale cache entry is an authorization bug, not a
performance bug. That is why invalidation lives in a subscriber, why TTLs stay
short, and why the integration test mutates a user and re-reads immediately.

Expected outcome:

- An authenticated request costs one Redis read instead of one or more
  Postgres queries.
- A role change or a remote logout takes effect on the next request.
- A Redis outage costs latency, not availability.

Expected commit:

```text
perf: serve authentication and authorization from cache
```

---

## Phase 18: Notifications

Status: Pending

Goal:

Send operational and user-facing notifications to Telegram, Slack and other
channels, without adding a dependency for any of them.

Tasks:

- [ ] Create `src/modules/notification` with `notification.service.ts`
- [ ] Define `NotificationChannel { name, isEnabled(), send(n) }`
- [ ] Implement `telegram.channel.ts` over raw HTTPS, no package
- [ ] Implement `slack.channel.ts` over an incoming webhook, no package, with
      Block Kit payloads
- [ ] Implement `discord.channel.ts` on the same webhook shape
- [ ] Implement `email.channel.ts` delegating to `MailService`
- [ ] Implement `console.channel.ts` as the development default
- [ ] Add a per-channel enable flag, retry policy and dead-letter list
- [ ] Make `notify()` asynchronous and failure-isolated; a broken webhook must
      never fail a registration
- [ ] Add `notification_preferences` so a user can opt out per event and
      channel
- [ ] Add `GET /notifications/preferences` and `PATCH /notifications/preferences`
- [ ] Add the `notification_log` entity, purged by Phase 16
- [ ] Centralise MarkdownV2 escaping in one helper; Telegram rejects messages
      containing unescaped `_`, `*` and backticks
- [ ] Support Telegram topic/thread ids to route event types to different rooms
- [ ] Emit these events: user registered, user deleted, repeated failed logins,
      new device login, 2FA enabled or disabled, retention job anomaly

Implementation note: the channel interface is the whole extension story. A
third party adds a channel by providing one class; the core is not modified.

Expected outcome:

- Registration triggers a notification on every enabled channel.
- Disabling a channel is a config flag, and a failing channel never blocks the
  request.

Expected commit:

```text
feat: add multi-channel notifications
```

---

## Phase 19: Account Security Features

Status: Pending

Goal:

Close the account-lifecycle gaps that real deployments get asked about.

Tasks:

- [ ] Add an email verification gate, blocking sensitive actions until the
      address is verified
- [ ] Add a password policy in zod, with an optional `zxcvbn` strength score
- [ ] Check new passwords against a breach list using the k-anonymity API, or
      an offline list
- [ ] Keep the last N password hashes and reject reuse
- [ ] Add an account lockout after N failed attempts, with an unlock flow and
      a notification
- [ ] Add an audit log entity: actor, action, before/after diff, ip, user
      agent, request id, append-only
- [ ] Record an audit entry on every privileged action, through an interceptor
      plus a TypeORM subscriber for writes that bypass a controller
- [ ] Add an `Idempotency-Key` header guard on mutating endpoints, so a client
      retry after a timeout cannot create a duplicate
- [ ] Add `@VersionColumn()` to the mutable entities for optimistic concurrency
- [ ] Add `user.requestDeletion()`: soft delete, queue a data export, hard
      delete at the end of the retention window, a right-to-erasure flow built
      on Phase 16
- [ ] Add a data export endpoint, CSV and JSON, streamed for large result sets

Expected outcome:

- Insecure passwords, unverified addresses and repeated attacks are all visible
  and handled.
- Every privileged action is attributable to a person and a request.

Expected commit:

```text
feat: add account security, audit log and idempotency
```

---

## Phase 20: Operational Hardening

Status: Pending

Goal:

Make the new features observable and operable, so a failure at 3am is a
dashboard, not an investigation.

Tasks:

- [ ] Extend `/health` with mail transport, queue connectivity and backlog
      depth, all reporting degraded rather than down
- [ ] Expose the last successful maintenance run in the health payload
- [ ] Add Prometheus metrics: `mail_sent_total`, `mail_failures_total`,
      `notification_sent_total`, `job_lag_seconds`,
      `retention_rows_deleted_total`
- [ ] Add OpenTelemetry traces spanning HTTP, database and job execution
- [ ] Propagate `X-Request-Id` into every log line, mail record and
      notification record
- [ ] Add Sentry error reporting with release tagging
- [ ] Add alert rules: failure rate above a threshold, a non-empty dead-letter
      list, a maintenance job that has not run in 26 hours
- [ ] Redact token, secret and OTP fields in the logger
- [ ] Add a runbook in `docs/`: provider outage, Redis loss, queue backlog, and
      tracing a missing email through `mail_logs`
- [ ] Add a Grafana dashboard for auth failure rate, job lag and mail delivery

Expected outcome:

- Each new subsystem is visible before it is asked about.
- The runbook answers the common failure questions without reading code.

Expected commit:

```text
feat: add observability and operations for the new subsystems
```

---

## Phase 21: Testing Depth and Documentation

Status: Pending

Goal:

Prove the new behaviour, especially the optional-dependency and cache paths,
which are the ones that fail quietly.

Tasks:

- [ ] Add unit tests for every new service and template
- [ ] Add an integration test that boots the app with an empty
      `optionalDependencies` and asserts every feature degrades cleanly
- [ ] Add a cache test that mutates a user and re-reads immediately, asserting
      invalidation happened rather than trusting the TTL
- [ ] Add a retention test with a dry run, asserting nothing is deleted
- [ ] Add `testcontainers` for real Postgres and Redis in e2e
- [ ] Run the e2e suite in CI against service containers, it currently only
      type checks
- [ ] Add a k6 or Artillery smoke test for login, register and refresh
- [ ] Add mutation testing on the auth and retention paths, where a silent
      logic error is expensive
- [ ] Write `src/modules/mail/README.md`, `src/modules/queue/README.md`,
      `src/modules/notification/README.md`, `src/modules/maintenance/README.md`
- [ ] Update `docs/production.md` and the root `README.md` with the new
      environment variables and the module list

Expected outcome:

- A regression in cache invalidation or optional loading fails CI.
- Every new module is documented next to its code, in the same commit.

Expected commit:

```text
test: cover optional dependencies, cache invalidation and retention
```

---

## Phase 22: Configurable Email Templates

Status: Pending

Goal:

Let an operator change a welcome email or a password reset email without a
deploy, by storing the template in the database and rendering it with a real
engine. Phase 14 ships plain functions, which is right for a boilerplate: the
templates in the repository are code, they are reviewed in a diff, and the app
has no template dependency at all. This phase trades both for editability.

Tasks:

- [ ] Add `handlebars` as a dependency, and say plainly in the README that the
      no-dependency property of Phase 14 is what is being given up
- [ ] Create the `email_templates` entity: name, locale, subject, text, html,
      version, `updatedBy`, timestamps
- [ ] Ship the six Phase 14 templates as `.hbs` files, and seed the table from
      them so a fresh clone has every template present
- [ ] Make the database row the override and the `.hbs` file the fallback, so an
      app with an empty table still sends every mail
- [ ] Render through `CacheService.wrap()` under a new `CACHE_NAMESPACE.Mail`
      key, so a hot template expiring under load does not stampede the table
- [ ] Invalidate the cache entry on every template write, so an edit takes
      effect on the next send rather than after a TTL
- [ ] Add `GET/PUT /admin/mail-templates/:name` behind a permission, writing an
      audit entry through the Phase 19 audit log
- [ ] Reject a stored template containing `{{{`, since raw interpolation of a
      user-controlled field is stored XSS in the mail client
- [ ] Keep the per-template data contract: the admin form lists the allowed
      fields, so an editor cannot add a variable no call site supplies
- [ ] Preview a stored template against sample data before saving it
- [ ] Purge template versions older than the Phase 16 retention window

Implementation note: a stored template is untrusted input even though only an
admin writes it. Handlebars escapes `{{ }}` and not `{{{ }}}`, so a template
that opts out of escaping turns a first name into script in a mail client. The
narrow rule is that the `{{{` sequence is rejected in anything read from the
database, while a `.hbs` file in the repository is trusted because it went
through review.

Expected outcome:

- An operator edits a transactional email in the running app, with a preview,
  and the change reaches the next send.
- A template can still be reviewed in a diff, because the file remains the
  fallback and the seed.

Expected commit:

```text
feat: add database-managed email templates
```

---

## Follow-up Candidates

Not scheduled. Each needs a decision before it becomes a phase.

- File uploads to S3-compatible storage, with presigned URLs, content-type
  validation and a virus scan hook.
- Feature flags and remote config, Redis-backed, evaluated server-side.
- Completing the admin module: pagination, filtering, force logout, impersonation
  with an audit trail, and a role editor.
- API deprecation headers, `Sunset` and per-version throttles, on top of the
  existing `/api/v1` prefix.
- Multi-tenancy, an optional `tenantId` plus a global scope. Only worth it for a
  SaaS product, so it is deliberately last.
- Pagination on the admin and user listing routes, which still return everything
  they match.
- A shared throttler store, so rate limits are global across replicas.
- Restricting `GET /users/:id` to the record's owner or an admin. It is still
  readable by any authenticated user, which is recorded as an open decision in
  `src/modules/users/README.md`.

---

## Current Execution Rule

One phase at a time, in the order below.

Before starting a phase:

1. Review this plan.
2. Confirm the target phase.
3. Implement only the required files.
4. Run `npm run check` when applicable.
5. Commit the phase separately.

The order is not arbitrary. Mail without a queue blocks requests. Retention
without a queue either runs inside a request or does not run at all. The cache
work is independent but is the highest-risk change to existing behaviour, so it
lands after the harness in Phase 12 is solid.

---

## Progress Tracking

| Phase    | Name                                           | Status  |
| -------- | ---------------------------------------------- | ------- |
| Phase 0  | Project Architecture Skeleton                  | Done    |
| Phase 1  | Base Application Foundation                    | Done    |
| Phase 2  | Users Module                                   | Done    |
| Phase 3  | Auth Module - Basic JWT                        | Done    |
| Phase 4  | Authorization - RBAC and Manager Scope         | Done    |
| Phase 5  | Admin Module Foundation                        | Done    |
| Phase 6  | API Documentation                              | Done    |
| Phase 7  | Refresh Tokens                                 | Done    |
| Phase 8  | Device Authentication                          | Done    |
| Phase 9  | Two-Factor Authentication                      | Done    |
| Phase 10 | Cache and Performance                          | Done    |
| Phase 11 | Production Hardening                           | Done    |
| Phase 12 | Optional Integration Foundation                | Done    |
| Phase 13 | Configuration Expansion                        | Done    |
| Phase 14 | Outbound Email                                 | Pending |
| Phase 15 | Background Job Queue                           | Pending |
| Phase 16 | Data Retention and Cleanup                     | Pending |
| Phase 17 | Authentication and Authorization through Cache | Pending |
| Phase 18 | Notifications                                  | Pending |
| Phase 19 | Account Security Features                      | Pending |
| Phase 20 | Operational Hardening                          | Pending |
| Phase 21 | Testing Depth and Documentation                | Pending |
| Phase 22 | Configurable Email Templates                   | Pending |
