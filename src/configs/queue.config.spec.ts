import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { queueConfig, type QueueName } from './queue.config.js';

const KEYS = [
  'QUEUE_ENABLED',
  'QUEUE_REDIS_URL',
  'REDIS_URL',
  'QUEUE_PREFIX',
  'QUEUE_JOB_TIMEOUT',
  'QUEUE_RETRY_ATTEMPTS',
  'QUEUE_RETRY_DELAY',
  'QUEUE_RETRY_MAX_DELAY',
  'QUEUE_CONCURRENCY_MAIL',
  'QUEUE_CONCURRENCY_NOTIFICATION',
  'QUEUE_CONCURRENCY_MAINTENANCE',
  'QUEUE_CONCURRENCY_DIGEST',
  'QUEUE_REMOVE_COMPLETE_AFTER',
  'QUEUE_REMOVE_FAIL_AFTER',
  'QUEUE_IN_PROCESS_FALLBACK',
  'QUEUE_IN_PROCESS_CONCURRENCY',
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

describe('queueConfig', () => {
  it('is off by default, so the app runs its processors in process', () => {
    expect(queueConfig().enabled).toBe(false);
  });

  it('leaves the url empty rather than pointing at localhost', () => {
    // An empty url is a loud failure; a guessed one is a silent localhost
    // connection attempt in production.
    expect(queueConfig().url).toBe('');
  });

  it('falls back to the shared redis url', () => {
    process.env.REDIS_URL = 'redis://localhost:6379/1';

    expect(queueConfig().url).toBe('redis://localhost:6379/1');
  });

  it('prefers the queue url over the shared one', () => {
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.QUEUE_REDIS_URL = 'redis://localhost:6379/2';

    expect(queueConfig().url).toBe('redis://localhost:6379/2');
  });

  it('uses a prefix distinct from the cache one', () => {
    expect(queueConfig().prefix).toBe('queue');
  });

  it('retries five times, which covers a provider blip without looping', () => {
    expect(queueConfig().retry.attempts).toBe(5);
  });

  it('caps a single backoff wait, so a long outage does not park a job', () => {
    expect(queueConfig().retry.backoffMaxDelay).toBe(60_000);
  });

  it('gives maintenance the lowest concurrency and mail a bounded one', () => {
    const { concurrency } = queueConfig();

    expect(concurrency.maintenance).toBe(1);
    expect(concurrency.mail).toBe(5);
  });

  it('overrides concurrency per queue', () => {
    process.env.QUEUE_CONCURRENCY_MAIL = '20';
    process.env.QUEUE_CONCURRENCY_MAINTENANCE = '3';

    expect(queueConfig().concurrency).toMatchObject({
      mail: 20,
      maintenance: 3,
    });
  });

  it('keeps a concurrency of one, which is a real value not a missing one', () => {
    process.env.QUEUE_CONCURRENCY_DIGEST = '1';

    expect(queueConfig().concurrency.digest).toBe(1);
  });

  it('falls back in process when the queue is off, so mail is not dropped', () => {
    expect(queueConfig().inProcessFallback).toBe(true);
  });

  it('bounds the in-process limiter', () => {
    process.env.QUEUE_IN_PROCESS_CONCURRENCY = '2';

    expect(queueConfig().inProcessConcurrency).toBe(2);
  });

  it('discards a job that has waited past its timeout', () => {
    expect(queueConfig().jobTimeout).toBe(300_000);
  });

  it('covers every queue name it declares', () => {
    const names: QueueName[] = [
      'mail',
      'notification',
      'maintenance',
      'digest',
    ];

    for (const name of names) {
      expect(queueConfig().concurrency[name]).toBeGreaterThan(0);
    }
  });
});
