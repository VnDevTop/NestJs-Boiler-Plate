import { describe, expect, it } from 'vitest';

import {
  backoffDelay,
  DEFAULT_BACKOFF_DELAY,
  DEFAULT_BACKOFF_MAX_DELAY,
  DEFAULT_RETRY_ATTEMPTS,
  isRetryable,
  retryWindowMs,
  toRetryPolicy,
} from './retry.policy.js';

describe('backoffDelay', () => {
  it('does not delay the first attempt, which is not a retry', () => {
    expect(backoffDelay(1, { delay: 1000 })).toBe(1000);
  });

  it('doubles on each attempt', () => {
    const delays = [1, 2, 3, 4].map((attempt) =>
      backoffDelay(attempt, { delay: 1000 }),
    );

    expect(delays).toEqual([1000, 2000, 4000, 8000]);
  });

  it('caps a single wait, so an outage cannot park a job for days', () => {
    expect(backoffDelay(20, { delay: 1000, maxDelay: 60_000 })).toBe(60_000);
  });

  it('caps rather than overflowing on a large attempt count', () => {
    // 2 ** 1023 is Infinity; an unguarded shift would come back negative and a
    // negative delay would busy-loop instead of waiting.
    const delay = backoffDelay(1024, { delay: 1000, maxDelay: 60_000 });

    expect(delay).toBe(60_000);
    expect(delay).toBeGreaterThan(0);
  });

  it('treats an attempt below one as no wait at all', () => {
    expect(backoffDelay(0)).toBe(0);
    expect(backoffDelay(-1)).toBe(0);
  });

  it('has defaults, so a caller cannot forget them', () => {
    expect(backoffDelay(1)).toBe(DEFAULT_BACKOFF_DELAY);
  });
});

describe('toRetryPolicy', () => {
  it('declares five attempts with exponential backoff', () => {
    expect(toRetryPolicy()).toEqual({
      attempts: 5,
      backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY },
    });
  });

  it('passes the configured delay through', () => {
    expect(toRetryPolicy({ delay: 250 }).backoff.delay).toBe(250);
  });
});

describe('isRetryable', () => {
  it('retries a result that says nothing, because an unclassified fault is transient', () => {
    expect(isRetryable({ ok: false, error: 'boom' })).toBe(true);
  });

  it('does not retry a result the processor marked permanent', () => {
    // A 4xx from a provider answers the same way next time, so retrying spends
    // the budget and delays the dead-letter entry that would explain why.
    expect(isRetryable({ ok: false, error: '400', retryable: false })).toBe(
      false,
    );
  });

  it('retries an explicit yes', () => {
    expect(isRetryable({ ok: false, retryable: true })).toBe(true);
  });
});

describe('retryWindowMs', () => {
  it('outlives every wait the retry budget allows', () => {
    const window = retryWindowMs({ delay: 1000 });
    const waits = [1, 2, 3, 4].reduce(
      (sum, attempt) => sum + backoffDelay(attempt, { delay: 1000 }),
      0,
    );

    // A key that expires mid-retry lets a redelivery through as a new job, which
    // is the duplicate the key exists to prevent.
    expect(window).toBeGreaterThan(waits);
  });

  it('covers five attempts by default', () => {
    const expectedWaits = Array.from(
      { length: DEFAULT_RETRY_ATTEMPTS - 1 },
      (_, index) => backoffDelay(index + 1),
    ).reduce((sum, value) => sum + value, 0);

    expect(retryWindowMs()).toBe(expectedWaits + DEFAULT_BACKOFF_MAX_DELAY);
  });

  it('grows with a larger base delay', () => {
    expect(retryWindowMs({ delay: 2000 })).toBeGreaterThan(
      retryWindowMs({ delay: 1000 }),
    );
  });
});
