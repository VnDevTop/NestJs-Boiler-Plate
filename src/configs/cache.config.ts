import { registerAs } from '@nestjs/config';

export type CacheBackend = 'redis' | 'valkey' | 'memory';

export interface CacheConfig {
  backend: CacheBackend;
  /**
   * One connection string, for example
   * `redis://user:password@localhost:6379/0`. Valkey speaks the Redis
   * protocol, so the same scheme is used for both; only `backend` differs. A
   * single URL is the whole connection config on purpose: host, port,
   * credentials, TLS and database all live in it, which is what the Redis
   * client itself takes.
   */
  url: string;
  /** Prepended to every key, so one database can host several applications. */
  keyPrefix: string;
  /** Default entry lifetime in seconds. */
  defaultTtl: number;
  /**
   * Lifetime for a "not found" answer, kept short so a record created right
   * after a lookup is not hidden behind a long negative cache entry.
   */
  emptyTtl: number;
  connectTimeout: number;
}

function toBackend(value: string | undefined): CacheBackend {
  return value === 'memory' || value === 'valkey' ? value : 'redis';
}

export const cacheConfig = registerAs('cache', (): CacheConfig => ({
  backend: toBackend(process.env.CACHE_BACKEND),
  url: process.env.CACHE_URL ?? 'redis://localhost:6379/0',
  keyPrefix: process.env.CACHE_KEY_PREFIX ?? 'app',
  defaultTtl: Number(process.env.CACHE_DEFAULT_TTL ?? 300),
  emptyTtl: Number(process.env.CACHE_EMPTY_TTL ?? 10),
  connectTimeout: Number(process.env.CACHE_CONNECT_TIMEOUT ?? 2000),
}));
