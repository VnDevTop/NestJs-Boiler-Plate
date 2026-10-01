/**
 * The job queue's contract with the rest of the application.
 *
 * Nothing in this file mentions BullMQ, Redis or a timer. That is the whole
 * point: a caller asks for a job to be run, and whether that means an enqueue to
 * Redis or an in-process promise depends on configuration the caller never sees.
 * It is also what makes the in-process fallback a real fallback rather than a
 * second implementation, because both dispatchers hand the payload to the same
 * processor.
 */

export const QUEUE_NAMES = {
  mail: 'mail',
  notification: 'notification',
  maintenance: 'maintenance',
  digest: 'digest',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * A unit of work, addressed by name.
 *
 * `payload` is `unknown` deliberately: the processor for a name is the only thing
 * that knows its shape, and a union here would couple every enqueue site to every
 * job type. The processor validates on the way in.
 */
export interface Job<TPayload = unknown> {
  name: string;
  payload: TPayload;
  /**
   * Identity used by the deduplication guard.
   *
   * Two enqueues with the same key are the same job, so a redelivery or a client
   * retry cannot produce a second email. Left unset by callers that genuinely
   * want every enqueue to run.
   */
  dedupeKey?: string;
}

/**
 * What the processor returned.
 *
 * `retryable` is the processor's opinion and it matters: a provider that answered
 * 4xx will answer 4xx again, so retrying it only spends the budget and delays the
 * dead-letter entry that would tell an operator something is misconfigured.
 */
export interface JobResult {
  ok: boolean;
  /** Set when the work failed, for the log line and the dead-letter entry. */
  error?: string;
  /**
   * False when the failure is permanent. Defaults to true, so a processor that
   * throws rather than returning is retried, which is the safe default for a
   * transient fault.
   */
  retryable?: boolean;
}

/** How a job should be retried. Mirrors what a queue backend needs. */
export interface RetryPolicy {
  attempts: number;
  backoff: { type: 'exponential'; delay: number };
}

/**
 * The one thing callers use.
 *
 * Both implementations — BullMQ and in-process — satisfy this, so a service
 * injects the token and never branches on which one it got.
 */
export interface JobQueue {
  /** Human-readable name of the active implementation, for the health check. */
  readonly driver: 'bullmq' | 'in-process';
  enqueue(queue: QueueName, job: Job): Promise<void>;
  /**
   * Registers repeating work. Ignored by the in-process driver when the queue is
   * off, which the caller does not have to care about.
   */
  schedule(queue: QueueName, name: string, cron: string): Promise<void>;
}
