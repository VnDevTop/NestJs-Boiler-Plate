import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cacheConfig } from './cache.config.js';
import { redisConfig } from './redis.config.js';

const KEYS = [
  'REDIS_URL',
  'REDIS_KEY_PREFIX',
  'REDIS_CONNECT_TIMEOUT',
  'REDIS_DISABLE_OFFLINE_QUEUE',
] as const;

beforeEach(() => {
  for (const key of KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    delete process.env[key];
  }
});

describe('redisConfig', () => {
  it('defaults to database 1, clear of the cache at database 0', () => {
    expect(redisConfig().url).toBe('redis://localhost:6379/1');
  });

  it('uses a prefix of its own, so a cache sweep cannot reach a queue job', () => {
    // A cache entry is disposable; a pending job and a throttle counter are not.
    expect(redisConfig().keyPrefix).not.toBe(cacheConfig().keyPrefix);
  });

  it('shares a server with the cache by default without sharing a namespace', () => {
    expect(redisConfig().url).not.toBe(cacheConfig().url);
  });

  it('reads the url and prefix', () => {
    process.env.REDIS_URL = 'rediss://user:pass@host:6380/4';
    process.env.REDIS_KEY_PREFIX = 'billing';

    expect(redisConfig()).toMatchObject({
      url: 'rediss://user:pass@host:6380/4',
      keyPrefix: 'billing',
    });
  });

  it('does not queue commands while the socket is reconnecting', () => {
    // Otherwise every request in flight waits on a socket that may not return.
    expect(redisConfig().disableOfflineQueue).toBe(true);
  });

  it('lets a deployment opt back into the offline queue', () => {
    process.env.REDIS_DISABLE_OFFLINE_QUEUE = 'false';

    expect(redisConfig().disableOfflineQueue).toBe(false);
  });
});
