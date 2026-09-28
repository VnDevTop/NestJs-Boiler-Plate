# Roadmap

What this template already does, and the enhancements worth building on top of
it. Written for someone about to add features, so each item says what it involves
and what it costs, not just what it is.

[PLAN.md](PLAN.md) is the phase by phase record of what was built.
[CHANGELOG.md](CHANGELOG.md) is what each change did and why.

---

## Shipped

The boilerplate is complete through production hardening. This is a working
starting point rather than a scaffold to fill in.

| Area          | What works                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Sessions      | Rotating refresh tokens, locked so concurrent refreshes have one winner; replay treated as theft |
| Devices       | Fingerprinted by user agent, revocation cascades to tokens                                       |
| Two-factor    | Optional TOTP, secret encrypted at rest, single use steps, one time recovery codes               |
| Authorisation | `@Roles()`, `@ManagerOnly()`, a `@Permissions()` placeholder                                     |
| Configuration | Namespaced and typed, whole environment validated before anything connects                       |
| Cache         | Redis or Valkey with request coalescing and stale while revalidate                               |
| Rate limiting | Global, tightened on every route that accepts a secret                                           |
| Observability | Request id, JSON production logs, liveness and readiness kept apart                              |
| Operations    | Reviewed migrations, idempotent seed, two stage image, compose stack, CI                         |

## Open decisions

Not features. Each is a decision that has not been made, and the cost of leaving
it unmade is the point.

| Decision                                           | Why it matters                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Restrict `GET /users/:id` to the owner or an admin | Any authenticated user can read another user's profile, email included |
| Share the rate limit counters                      | The effective limit is the configured one times the replica count      |
| Paginate the listing routes                        | `GET /users` and the admin dashboard return every matching row         |

---

## Enhancement plans

Ordered by what most real projects need first. Each is a plan, not a promise.

### 1. Email

Nothing else in this list is blocked on it, and several things on it are worse
without it.

- A mailer behind an interface, so the transport is swappable and tests use a
  fake. Welcome on registration, email verification, password reset, a notice
  when a new device signs in, and a notice when 2FA is enabled or disabled.
- Verification and reset tokens belong in a table with an expiry and a
  single-use column, not in the JWT signed by the existing secret. They outlive
  one request and are consumed by a lookup, which is a different shape from a
  session token.
- Sending happens on a queue, not in the request. A slow SMTP provider must not
  be able to fail a signup.
- A user is not fully registered until the address is verified, and a verified
  address is the precondition for password reset.

**Watch out:** an account enumeration leak in the "forgot password" response.
Answer the same way whether or not the address exists.

### 2. Data cleanup

The database only gets bigger, and soft deleted rows and revoked tokens are pure
cost once nobody can use them.

- A scheduled job, not a cron entry someone remembers. It runs inside the
  application so it is observable, and it takes a lock so two replicas do not run
  it at once.
- Soft deleted users after 30 days, expired refresh tokens, and two-factor
  secrets for users who no longer exist.
- Batched deletes with a limit per pass. A single `DELETE` over a large table
  locks it and can take the site down, which is a self inflicted outage.
- A dry run mode that reports what would be deleted. The first time this runs
  against real data, the operator should see the count before it happens.
- Retention is a policy, not a constant. Thirty days is a default, and the
  decision belongs to whoever owns the data.

**Watch out:** foreign keys. Deleting a user cascades to devices and tokens by
design, so the order matters and a partial run must be restartable.

### 3. Auth and authorisation through the cache

The obvious win, and the one with the sharpest edge, because this is the one
place the template deliberately does not cache.

- `JwtStrategy` reads `isActive`, `role` and `isManager` on every request, so a
  deactivation or a role change takes effect immediately. A cache makes that
  window real: for as long as the entry lives, a revoked user is still valid.
- The workable shape is a **negative** cache only. Cache "this user is not
  active" and "this user does not exist", never the positive claims. Those fail
  closed, so a stale entry denies rather than grants.
- Every write that touches those fields invalidates explicitly, and every
  deployment invalidates by version prefix, so a new release does not inherit
  entries written by the old code.
- A short TTL on the positive entries, with the window named in the README rather
  than left as a number in a config file.

**Watch out:** a role escalation that survives in the cache until it expires.
This is why the template does not cache it by default, and why the negative-only
shape is the recommendation.

### 4. Notifications

- Delivery to Telegram, Slack, Discord, email and a webhook, behind one interface
  so a feature emits an event and does not know which channels are configured.
- **Dependencies must not be in `package.json` for a feature that is not in use.**
  A template that ships four SDKs costs install time, cold start memory and
  attack surface for features nobody enabled. Two workable ways:
  - `optionalDependencies`, so `npm install` does not fail and a missing channel
    is reported at startup rather than at send time.
  - `await import()` at call time, so the module is only loaded when a message is
    actually sent. This costs a dynamic import on the send path and nothing
    otherwise.
- Retry with backoff, and a dead letter destination. A notification that failed
  silently is worse than one that was never sent, because you believe it went out.
- Webhook deliveries signed with HMAC, with a timestamp in the header so the
  receiver can reject a replay.

### 5. Background jobs

Both of the plans above need one, and it is worth having on its own.

- A queue for anything a user should not wait for: email, cleanup, exports,
  webhooks.
- At-least-once delivery, with every job handler idempotent, because a queue
  gives you duplicates rather than promises.
- Retries with exponential backoff and a dead letter queue, so a poison message
  does not block the queue behind it.
- The handler re-checks its own precondition, because state can change between
  the enqueue and the run.

### 6. The rest, in rough order

Each earns its place in a real project. None is a template's job to build.

- **Pagination and filtering.** Cursor pagination for anything that can grow
  without bound. Offset pagination skips and duplicates rows when the underlying
  data changes mid page.
- **File uploads.** Direct to object storage with a signed URL, so a large file
  never passes through the API process. Size and type validated on the signature
  request, not after the upload.
- **Audit log.** Who changed what, when, and from where. Append only, kept out of
  the tables it records, and queryable separately from the operational database.
  Written by an interceptor, so a new route is covered by default.
- **Account lockout.** Distinct from rate limiting, which limits a route. This
  limits an account, survives the counter being reset, and notifies the owner
  when it trips.
- **Permissions beyond roles.** `PermissionsGuard` is a placeholder. Roles cover
  the common case; a permission table and a decision about where permissions are
  assigned are what make it real.
- **Webhook signing and replay protection.** The same signing work the
  notification plan needs, for the outbound direction.
- **GDPR style data export and erasure.** A machine readable export, and an
  erasure that says what is deleted, anonymised, or kept for a legal reason.
- **Feature flags.** A kill switch for the risky path is worth more than a
  rollback, and it is cheaper to add before you need it.
- **Zero downtime migrations.** Expand, backfill, contract. A migration that
  renames a column in one step is an outage waiting for a deploy.
- **Read replica routing.** Worth it once reads dominate, and not before.
- **Localisation.** Message catalogues rather than concatenated strings, from the
  start, because extracting them later is painful.
- **API client generation.** Generate a typed client from the OpenAPI document
  the project already publishes, so the schema stops drifting.
- **Multi-tenancy.** Every table keyed by tenant, enforced in the repository
  rather than remembered per query. Far cheaper to start with than to retrofit.
- **Distributed locks.** Redis based, for the cases where a database row lock is
  not enough. The refresh rotation does not need one, which is why it uses a row
  lock.

---

## Explicitly not planned

So these are not proposed again.

- **A second cache driver.** `CACHE_BACKEND=memory` is for local development and
  nothing else. A configured but unreachable cache failing the boot is
  deliberate: silently serving per-process data looks like it works.
- **Pattern based cache invalidation.** Scanning a keyspace is unbounded on a
  shared server and a broad pattern fails silently. Callers that know what they
  changed pass those keys.
- **Shipping every optional integration as a dependency.** See the notification
  plan for why that is a cost, not a convenience.
- **A dependency injection rewrite.** Nest's own mechanism is what this template
  teaches.
