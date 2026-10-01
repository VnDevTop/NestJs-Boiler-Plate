/**
 * Retry policy, as pure functions.
 *
 * Nothing here reads a clock or a queue, so the decisions that decide whether a
 * job runs a second time can be tested without either. The queue backend
 * translates the result; it does not compute it.
 */

import type { JobResult, RetryPolicy } from './queue.interface.js';

/** Defaults from `queue.config.ts`, restated so the policy stands alone. */
export const DEFAULT_RETRY_ATTEMPTS = 5;
export const DEFAULT_BACKOFF_DELAY = 1_000;
export const DEFAULT_BACKOFF_MAX_DELAY = 60_000;

export interface BackoffOptions {
  delay?: number;
  maxDelay?: number;
}

/**
 * The wait before the next attempt.
 *
 * Attempt 1 is the first try and is not delayed; the wait after it is `delay`,
 * then `delay * 2`, then `delay * 4`. `attempt` is 1-based because that is how a
 * processor counts its own tries, and an off-by-one here silently doubles every
 * wait.
 *
 * The cap matters more than the curve: without it an outage long enough to
 * exhaust the budget would park the last retry for days, which is a job that
 * arrives after the problem it was about is over.
 */
export function backoffDelay(
  attempt: number,
  options: BackoffOptions = {},
): number {
  const base = options.delay ?? DEFAULT_BACKOFF_DELAY;
  const max = options.maxDelay ?? DEFAULT_BACKOFF_MAX_DELAY;

  if (attempt < 1) {
    return 0;
  }

  // Math.min before the shift, so a large attempt count cannot overflow into a
  // negative number and produce a negative delay.
  return Math.min(base * 2 ** (attempt - 1), max);
}

/** The options a queue backend needs for a job of this policy. */
export function toRetryPolicy(options: BackoffOptions = {}): RetryPolicy {
  return {
    attempts: DEFAULT_RETRY_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: options.delay ?? DEFAULT_BACKOFF_DELAY,
    },
  };
}

/**
 * Whether a result permits another attempt.
 *
 * Defaults to yes. A processor that throws instead of returning is retried, which
 * is the right default for a fault nobody classified, and the alternative would
 * mean one uncaught exception silently discards the work.
 */
export function isRetryable(result: JobResult): boolean {
  return result.retryable !== false;
}

/**
 * How long a deduplication key has to live.
 *
 * This is the subtle one. A key that expires while a job is still retrying lets a
 * redelivery through as a *new* job, which is the duplicate the key exists to
 * prevent. A key that outlives the retries by a large margin is only a delayed
 * duplicate. So the window is the sum of every wait the budget allows, plus the
 * time the last attempt itself may take.
 */
export function retryWindowMs(options: BackoffOptions = {}): number {
  const attempts = DEFAULT_RETRY_ATTEMPTS;
  const total = Array.from({ length: attempts - 1 }, (_, index) =>
    backoffDelay(index + 1, options),
  ).reduce((sum, value) => sum + value, 0);

  return total + DEFAULT_BACKOFF_MAX_DELAY;
}
