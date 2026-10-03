import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { Job, JobResult } from '../../queue/queue.interface.js';
import { RetentionTrigger } from '../entities/retention-trigger.enum.js';
import { MaintenanceLog } from '../entities/maintenance-log.entity.js';
import {
  RetentionService,
  type RetentionRunResult,
} from '../retention.service.js';

/** The one job name this processor answers to. */
export const RETENTION_JOB = 'maintenance.run-retention';

/**
 * What a retention job carries.
 *
 * `dryRun` is per job rather than only per deployment because the operator has to
 * be able to rehearse against production data without changing configuration and
 * restarting. `trigger` is carried so the log records who asked, which is the
 * whole reason the column exists.
 */
export interface RetentionJobPayload {
  dryRun?: boolean;
  trigger?: RetentionTrigger;
}

/**
 * Runs the retention policy as a queue job, and records what happened.
 *
 * Both dispatchers call this, the same as `MailProcessor`, which is what makes
 * the in-process path a real fallback rather than a second implementation.
 */
@Injectable()
export class RetentionProcessor {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(
    private readonly retentionService: RetentionService,
    @InjectRepository(MaintenanceLog)
    private readonly logs: Repository<MaintenanceLog>,
  ) {}

  /** True for the job name this processor handles, so routing stays in one place. */
  static handles(name: string): boolean {
    return name === RETENTION_JOB;
  }

  async process(job: Job<RetentionJobPayload>): Promise<JobResult> {
    const payload = this.validate(job.payload);

    if (payload === null) {
      // Retrying a malformed payload can only produce the same malformed payload.
      return {
        ok: false,
        error: `Malformed ${RETENTION_JOB} payload`,
        retryable: false,
      };
    }

    let result: RetentionRunResult;

    try {
      result = await this.retentionService.run({ dryRun: payload.dryRun });
    } catch (error) {
      // The service catches per target, so a throw here came from outside the
      // loop: no connection, or a pool that would not hand one out. No log row is
      // written, because the insert needs the same connection that just failed.
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Retention job threw before recording a run: ${message}`,
      );

      return { ok: false, error: message, retryable: true };
    }

    try {
      await this.record(result, payload.trigger ?? RetentionTrigger.Cron);
    } catch (error) {
      // The rows are already gone; only the record of it is missing. Retryable
      // because the next attempt re-runs an idempotent cleanup and tries the
      // insert again, which costs nothing but time.
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Retention run deleted ${result.totalDeleted} rows but could not be recorded: ${message}`,
      );

      return {
        ok: false,
        error: `run completed, log insert failed: ${message}`,
        retryable: true,
      };
    }

    return this.toJobResult(result);
  }

  /**
   * Turns a run outcome into a job outcome.
   *
   * A run that finished is a success even when individual targets failed. Those
   * failures are recorded, visible in the admin history, and would answer
   * identically to a retry: a renamed column is still renamed five seconds later,
   * so retrying only spends the budget and delays the dead-letter entry that
   * would tell an operator which table to look at.
   *
   * A timeout is the opposite. The run stopped with tables still unclean, so it is
   * reported as a failure and left retryable: the run is idempotent, so finishing
   * the remaining tables costs nothing but the time the lost connection was not
   * using anyway.
   */
  private toJobResult(result: RetentionRunResult): JobResult {
    if (result.timedOut) {
      return {
        ok: false,
        error: `run timed out with ${result.pending.length} targets not reached`,
        retryable: true,
      };
    }

    return { ok: true };
  }

  private async record(
    result: RetentionRunResult,
    trigger: RetentionTrigger,
  ): Promise<void> {
    const finishedAt = new Date(
      new Date(result.startedAt).getTime() + result.durationMs,
    );

    await this.logs.insert({
      startedAt: new Date(result.startedAt),
      finishedAt,
      durationMs: result.durationMs,
      dryRun: result.dryRun,
      totalDeleted: result.totalDeleted,
      timedOut: result.timedOut,
      trigger,
      pending: [...result.pending],
      failedTargets: [...result.failed],
      // Spread rather than assigned: the service types the list as readonly, and
      // TypeORM will not take a readonly array where it writes entities.
      targets: [...result.targets],
    });
  }

  private validate(payload: unknown): RetentionJobPayload | null {
    if (payload === null || payload === undefined) {
      return {};
    }

    if (typeof payload !== 'object') {
      return null;
    }

    const { dryRun, trigger } = payload as Partial<RetentionJobPayload>;

    if (dryRun !== undefined && typeof dryRun !== 'boolean') {
      return null;
    }

    if (
      trigger !== undefined &&
      !Object.values(RetentionTrigger).includes(trigger)
    ) {
      return null;
    }

    return { dryRun, trigger };
  }
}
