import { Logger } from '@nestjs/common';

import type { RedisClientService } from './redis-client.service.js';
import type { Job, JobResult } from './queue.interface.js';

const logger = new Logger('DeadLetter');

/** Where exhausted jobs are kept. */
export const DEAD_LETTER_LIST = 'dead-letter:jobs';

/** How many entries to keep. A runaway failure must not grow the list forever. */
export const DEAD_LETTER_MAX = 500;

export interface DeadLetterEntry {
  queue: string;
  job: string;
  /** The dedupe key, so an operator can correlate it with the logs. */
  dedupeKey?: string;
  attempts: number;
  error: string;
  /** True when the failure was classified permanent, false when retries ran out. */
  permanent: boolean;
  failedAt: string;
}

/**
 * Where jobs land when nothing else will work.
 *
 * Deliberately redis and not a table. This is operational data read by a human at
 * 3am, it is worthless after a few days, and putting it in postgres would add a
 * table that Phase 16 then has to remember to purge. Keeping it in redis means the
 * TTL does the cleanup and nothing has to be scheduled.
 *
 * Every write is best effort. If redis is the reason the job failed, the entry is
 * the *second* thing to be lost, and losing it must not escalate into the queue
 * failing too. The log alarm is the reliable channel; the list is the detail.
 */
export class DeadLetterService {
  constructor(
    private readonly redis: RedisClientService,
    private readonly queue: string,
  ) {}

  /**
   * Records one job that will not be retried.
   *
   * The `logger.error` is the alarm the plan asks for: a non-empty dead-letter list
   * is a thing to notice, but a list nobody reads is not an alarm.
   */
  async record(
    job: Job,
    result: JobResult,
    attempts: number,
  ): Promise<boolean> {
    const entry: DeadLetterEntry = {
      queue: this.queue,
      job: job.name,
      dedupeKey: job.dedupeKey,
      attempts,
      error: result.error ?? 'no reason given',
      permanent: result.retryable === false,
      failedAt: new Date().toISOString(),
    };

    // The payload is logged as JSON so it is greppable in the log store, and the
    // key is a hash so no address appears here either.
    logger.error(
      `Job exhausted, added to the dead-letter list: ${JSON.stringify(entry)}`,
    );

    const stored = await this.redis
      .pushToList(DEAD_LETTER_LIST, JSON.stringify(entry), DEAD_LETTER_MAX)
      .catch((error: unknown) => {
        logger.error(
          `Dead-letter write threw: ${error instanceof Error ? error.message : String(error)}`,
        );

        return false;
      });

    if (!stored) {
      logger.error(
        `Could not record ${job.name} in the dead-letter list, redis refused. ` +
          'The log line above is the only record of this failure.',
      );
    }

    return stored;
  }

  /** Current depth, for the health check and the runbook. */
  async size(): Promise<number> {
    return this.redis.listLength(DEAD_LETTER_LIST);
  }
}
