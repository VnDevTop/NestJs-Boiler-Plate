import { registerAs } from '@nestjs/config';

/**
 * The redis connection used by the queue and the shared throttler.
 *
 * Separate from `cacheConfig` on purpose. The two have different lifetimes: a
 * cache entry is disposable and evicted by TTL, while a queue job, a rate-limit
 * counter and a revoked-token marker must outlive a cache sweep. Pointing both
 * at one namespace means either a short TTL silently discards a pending job, or
 * a long one leaves the cache growing on its own.
 *
 * The two can still be the same server and the same database, which is the
 * common case. What must differ is the key prefix, and this namespace owns it.
 */

export interface RedisConfig {
  /** One connection string, including credentials, TLS and database. */
  url: string;
  /**
   * Prefix for every key written through this namespace. Deliberately not the
   * cache prefix: a cache sweep must never reach a queue job or a throttle
   * counter.
   */
  keyPrefix: string;
  connectTimeout: number;
  /**
   * Whether commands issued while the socket is reconnecting should wait.
   * Off, so a redis outage costs a miss rather than every request in flight
   * piling up behind a socket that is not coming back.
   */
  disableOfflineQueue: boolean;
}

export const redisConfig = registerAs('redis', (): RedisConfig => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379/1',
  // A different default database from the cache's /0, so two namespaces cannot
  // collide even if the prefixes are later made to match.
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'app:redis',
  connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT ?? 2_000),
  disableOfflineQueue: process.env.REDIS_DISABLE_OFFLINE_QUEUE !== 'false',
}));
