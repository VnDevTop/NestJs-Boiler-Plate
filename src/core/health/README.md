# Health

Liveness, readiness and the shutdown flag that connects them.

```text
GET /api/v1/health/live     liveness, touches nothing external
GET /api/v1/health/ready    database and cache
GET /api/v1/health          the same as ready
```

## Liveness and readiness are separate on purpose

Liveness must stay green while a dependency is down. A failing liveness probe
makes an orchestrator restart every healthy instance at exactly the moment the
database is having trouble, which turns one outage into a cluster-wide restart
loop.

Readiness is the one that goes red, so the load balancer sends traffic elsewhere
without anything being restarted.

All three are `@Public()`. A probe has no token, and a health endpoint that
depends on the auth system is a health endpoint that fails when auth is down.

## The cache check is a round trip

```ts
await this.cacheService.set(key, token, { ttl: 60 });
const value = await this.cacheService.get<string>(key);

return value === token ? up : down;
```

A plain read would report a dead cache as healthy. cache-manager turns a failing
store into a miss, so "unreachable" and "empty" are indistinguishable through a
read. Writing a value only this check knows and comparing it on the way back is
what separates them.

This is the same trap that made `CacheService.isHealthy()` impossible, which is
why that method does not exist.

## Shutdown

`ShutdownService` exposes `isShuttingDown`, flipped by the first shutdown signal.
`/health/ready` reports not ready from then on, so the instance drains before its
connections close. `app.enableShutdownHooks()` in `src/main.ts` is what lets SIGTERM
reach the process; `docker-compose.yml` gives it 30 seconds.
