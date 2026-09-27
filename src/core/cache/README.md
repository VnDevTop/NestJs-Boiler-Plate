# Cache

Redis or Valkey cache for NestJS, built on `@nestjs/cache-manager`, `keyv` and
`@keyv/redis`.

## Configuration

All connection settings live in one URL, which is what the Redis client takes
anyway, so there is no host/port/password/database to keep in sync.

```dotenv
CACHE_BACKEND=redis            # redis | valkey | memory
CACHE_URL=redis://localhost:6379/0
CACHE_KEY_PREFIX=nestjs_boiler_plate
CACHE_DEFAULT_TTL=300          # seconds
CACHE_EMPTY_TTL=10             # seconds, for "not found" answers
CACHE_CONNECT_TIMEOUT=2000     # milliseconds
```

Valkey speaks the Redis protocol, so it uses the same scheme, for example
`rediss://default:password@host:port/0`. Only `backend` differs, and it exists
to label metrics and logs rather than to pick a driver.

`memory` keeps everything in the process, so it is for local development and
tests. It is never a silent fallback: if a Redis or Valkey backend is configured
and the server cannot be reached, the app refuses to start.

## How it behaves when things go wrong

| Situation | Behaviour |
| --- | --- |
| Cache unreachable at boot | Boot fails with a clear error, the app does not listen |
| Cache dies after boot | Reads become misses, the loader runs, no 500s |
| Database slow | `refreshThreshold` serves the cached value and refreshes in the background |
| Key expires under load | Concurrent misses share one loader run |
| Repeated miss on the same key | Answered from a short lived negative entry |
| Many keys expire at once | Expirations carry a jitter, so they do not expire together |

One cost to be aware of. While the cache is down, the store re-attempts the
connection on every operation, and each attempt waits out
`CACHE_CONNECT_TIMEOUT`. A cached read that misses and then fails to write back
means one request pays roughly twice that timeout. Measured against a cache that
was unreachable the whole time, with the default 2000ms:

```text
one request        4003ms
ten requests       40022ms
100 concurrent      4002ms, and still 1 database call
```

So the outage costs latency, not correctness: nothing fails that would otherwise
succeed, and concurrent requests for the same key still share a single loader
run. Lower `CACHE_CONNECT_TIMEOUT` to trade connection strictness for a smaller
penalty, which is the knob for it.

There is deliberately no `isHealthy()`. cache-manager reports a failing store as
a miss rather than an error, so no read through it can tell "empty" from
"unreachable" and a check built on it would always report healthy. The health
endpoint belongs to the production hardening phase, where it can ping the server
directly.

## Caching in a service

`wrap()` is the miss handler. It serves the cached value, otherwise it calls the
loader and caches the result, so the failover back to the database is just the
loader running.

```ts
const product = await this.cacheService.wrap(
  cacheKey(CACHE_NAMESPACE.Product, id),
  () => this.productsRepository.findOneByOrFail({ id }),
  { ttl: 60 },
);
```

Two properties decide whether a hot endpoint survives real traffic, and both
come from cache-manager rather than being hand rolled:

**Request coalescing.** When a key is invalidated or expires while traffic is in
flight, every waiting request would otherwise call the loader at once, and the
loader is exactly what you were trying to protect. cache-manager keeps one load
in flight per key, so a burst collapses into a single call.

**Stale while revalidate.** `refreshThreshold` starts a background refresh once
an entry is that close to expiring, and the read returns immediately. Useful when
the loader is slower than the latency budget:

```ts
// Refresh once the entry is 30s from a 5 minute expiry.
await this.cacheService.wrap(key, loader, { ttl: 300, refreshThreshold: 30 });
```

Other details worth knowing:

- `refresh(key, loader)` skips the read and always reloads, for after a mutation
  whose response must not come from cache.
- A nullish result is cached for `CACHE_EMPTY_TTL` rather than the full TTL, so
  a lookup that keeps missing stops hitting the loader every request, while a
  record created afterwards still appears quickly. This cannot help a client
  enumerating many different missing ids, since each of those is a different
  key; rate limiting is the tool for that.
- Expirations carry a 10% random reduction, so a bulk write does not put every
  entry on the same deadline and expire them in one burst.
- `getStats().loads` counts real loader calls, which is the number to watch to
  confirm the cache is absorbing traffic. Hits and misses are not reported:
  `wrap()` does not expose them, and reading first to find out would defeat
  stale while revalidate.

## Invalidation

```ts
await this.cacheService.deleteKeys(
  cacheKey(CACHE_NAMESPACE.User, userId),
  cacheKey(CACHE_NAMESPACE.Token, userId),
);
```

Keys only. There is no `deleteByPattern`, because evicting a namespace means
scanning a keyspace, which is unbounded on a shared server, and an accidentally
broad pattern is silent and expensive. Callers that know what they changed pass
those keys.

`deleteKeys` takes the logical keys without the store namespace, the same form
`cacheKey` produces; the store adds the prefix.

## Caching controller responses

`CacheInterceptor`, `CacheKey` and `CacheTTL` are re-exported from `core/cache`:

```ts
@Controller('products')
export class ProductController {
  @UseInterceptors(CacheInterceptor)
  @CacheKey(CACHE_NAMESPACE.Product)
  @CacheTTL(60)
  @Get(':id')
  findOne(@Param('id') id: string) { ... }
}
```

Prefer `CacheService.wrap()` when the value needs loading, validating or
combining several sources, since the interceptor only has the response to work
with.

Authentication state is not cached. `JwtStrategy` reads `isActive`, `role` and
`isManager` on every request on purpose, so a role change or a deactivation takes
effect immediately instead of after a TTL.
