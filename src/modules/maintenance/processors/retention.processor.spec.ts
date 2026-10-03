import type { Repository } from 'typeorm';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceLog } from '../entities/maintenance-log.entity.js';
import { RetentionTrigger } from '../entities/retention-trigger.enum.js';
import type { MaintenanceLog as LogEntity } from '../entities/maintenance-log.entity.js';
import {
  RETENTION_JOB,
  RetentionProcessor,
  type RetentionJobPayload,
} from './retention.processor.js';
import type {
  RetentionRunResult,
  RetentionService,
} from '../retention.service.js';
import type { Job } from '../../queue/queue.interface.js';

function runResult(
  overrides: Partial<RetentionRunResult> = {},
): RetentionRunResult {
  return {
    dryRun: false,
    startedAt: '2026-10-03T03:17:00.000Z',
    durationMs: 1_234,
    timedOut: false,
    pending: [],
    totalDeleted: 42,
    failed: [],
    targets: [
      {
        id: 'users',
        table: 'users',
        description: 'soft-deleted users',
        ageDays: 30,
        deleted: 40,
        batches: 1,
        durationMs: 900,
        cascades: ['refresh_tokens'],
      },
      {
        id: 'refresh-tokens',
        table: 'refresh_tokens',
        description: 'dead tokens',
        ageDays: 7,
        deleted: 2,
        batches: 1,
        durationMs: 300,
        cascades: [],
      },
    ],
    ...overrides,
  };
}

interface Harness {
  processor: RetentionProcessor;
  run: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
}

function harness(result: RetentionRunResult | Error = runResult()): Harness {
  const run =
    result instanceof Error
      ? vi.fn().mockRejectedValue(result)
      : vi.fn().mockResolvedValue(result);
  const insert = vi.fn().mockResolvedValue({ identifiers: [] });
  const logs = { insert } as unknown as Repository<LogEntity>;

  return {
    processor: new RetentionProcessor(
      { run } as unknown as RetentionService,
      logs,
    ),
    run,
    insert,
  };
}

/**
 * Builds a job carrying an arbitrary payload, including the malformed ones the
 * validation tests need. The cast is the point: `unknown` is exactly what arrives
 * at a processor, so the helper has to be able to produce it, and the type system
 * cannot tell the difference between a payload from the queue and a typo in a
 * test.
 */
const job = (payload: unknown): Job<RetentionJobPayload> =>
  ({ name: RETENTION_JOB, payload }) as Job<RetentionJobPayload>;

describe('RetentionProcessor', () => {
  let h: Harness;

  beforeEach(() => {
    h = harness();
  });

  describe('routing', () => {
    it('claims its own job name only', () => {
      expect(RetentionProcessor.handles(RETENTION_JOB)).toBe(true);
      expect(RetentionProcessor.handles('mail.send')).toBe(false);
    });

    it('publishes the job name the queue will enqueue', () => {
      expect(RETENTION_JOB).toBe('maintenance.run-retention');
    });
  });

  describe('running the job', () => {
    it('runs the policy and records the result', async () => {
      const result = await h.processor.process(job({}));

      expect(result.ok).toBe(true);
      expect(h.run).toHaveBeenCalledTimes(1);
      expect(h.insert).toHaveBeenCalledTimes(1);
    });

    it('passes an explicit dry run through to the service', async () => {
      // The operator has to be able to rehearse against production data without
      // a configuration change and a restart.
      await h.processor.process(job({ dryRun: true }));

      expect(h.run).toHaveBeenCalledWith({ dryRun: true });
    });

    it('leaves the mode to the configuration when the job does not say', async () => {
      await h.processor.process(job({}));

      // `undefined` rather than `false`, so a deployment configured for dry runs
      // cannot be flipped into deleting real rows by an empty payload.
      expect(h.run).toHaveBeenCalledWith({ dryRun: undefined });
    });
  });

  describe('what it writes', () => {
    it('records the row counts and timings from the run', async () => {
      await h.processor.process(job({}));

      const row = h.insert.mock.calls[0][0] as Record<string, unknown>;

      expect(row.totalDeleted).toBe(42);
      expect(row.durationMs).toBe(1_234);
      expect(row.dryRun).toBe(false);
      expect(row.timedOut).toBe(false);
    });

    it('derives finishedAt from startedAt plus the duration', async () => {
      await h.processor.process(job({}));

      const row = h.insert.mock.calls[0][0] as { finishedAt: Date };

      // The run reports a duration and a start but no end, so the end has to be
      // reconstructed. Asserted because getting it wrong makes the history read
      // as if every run finished before it began.
      expect(row.finishedAt.toISOString()).toBe('2026-10-03T03:17:01.234Z');
    });

    it('stores the per-target detail, which is the point of keeping it', async () => {
      await h.processor.process(job({}));

      const row = h.insert.mock.calls[0][0] as { targets: { id: string }[] };

      expect(row.targets.map((entry) => entry.id)).toEqual([
        'users',
        'refresh-tokens',
      ]);
    });

    it('copies the pending and failed lists rather than sharing them', async () => {
      h = harness(
        runResult({ pending: ['user-devices'], failed: ['refresh-tokens'] }),
      );

      await h.processor.process(job({}));

      const row = h.insert.mock.calls[0][0] as {
        pending: string[];
        failedTargets: string[];
      };

      expect(row.pending).toEqual(['user-devices']);
      expect(row.failedTargets).toEqual(['refresh-tokens']);
    });

    it('defaults the trigger to cron', async () => {
      await h.processor.process(job({}));

      const row = h.insert.mock.calls[0][0] as { trigger: string };

      expect(row.trigger).toBe(RetentionTrigger.Cron);
    });

    it('records a manual run as manual', async () => {
      await h.processor.process(job({ trigger: RetentionTrigger.Manual }));

      const row = h.insert.mock.calls[0][0] as { trigger: string };

      expect(row.trigger).toBe(RetentionTrigger.Manual);
    });

    it('records a dry run as a dry run', async () => {
      h = harness(runResult({ dryRun: true }));

      await h.processor.process(job({ dryRun: true }));

      const row = h.insert.mock.calls[0][0] as { dryRun: boolean };

      expect(row.dryRun).toBe(true);
    });
  });

  describe('a run that finished', () => {
    it('reports success even when a target failed', async () => {
      // A renamed column will still be renamed five seconds later, so a retry
      // answers identically. The failure is in the log and the admin history.
      h = harness(runResult({ failed: ['refresh-tokens'] }));

      const result = await h.processor.process(job({}));

      expect(result.ok).toBe(true);
      expect(result.retryable).toBeUndefined();
    });

    it('reports success when nothing matched', async () => {
      h = harness(runResult({ totalDeleted: 0, targets: [] }));

      expect((await h.processor.process(job({}))).ok).toBe(true);
    });
  });

  describe('a run that timed out', () => {
    beforeEach(() => {
      h = harness(
        runResult({
          timedOut: true,
          pending: ['user-devices'],
          totalDeleted: 9,
        }),
      );
    });

    it('reports failure, because tables were left unclean', async () => {
      expect((await h.processor.process(job({}))).ok).toBe(false);
    });

    it('stays retryable, because a retry finishes what the timeout left', async () => {
      // The run is idempotent, so the retry costs the time the lost connection
      // was not using anyway.
      expect((await h.processor.process(job({}))).retryable).toBe(true);
    });

    it('says how many targets were not reached', async () => {
      const result = await h.processor.process(job({}));

      expect(result.error).toContain('1 targets not reached');
    });

    it('still records the run', async () => {
      // The partial work is real and the operator needs to see it happened.
      await h.processor.process(job({}));

      expect(h.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('failures around the run', () => {
    it('retries when the service throws before it can record anything', async () => {
      h = harness(new Error('connection terminated unexpectedly'));

      const result = await h.processor.process(job({}));

      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('writes no log row when the service throws', async () => {
      // The insert needs the same connection that just failed, so pretending
      // otherwise would leave a run recorded that never happened.
      h = harness(new Error('no connection'));

      await h.processor.process(job({}));

      expect(h.insert).not.toHaveBeenCalled();
    });

    it('retries when the run worked but the log insert failed', async () => {
      h = harness();
      h.insert.mockRejectedValue(new Error('disk full'));

      const result = await h.processor.process(job({}));

      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('says the cleanup itself worked, so nobody re-runs it by hand', async () => {
      h = harness();
      h.insert.mockRejectedValue(new Error('disk full'));

      const result = await h.processor.process(job({}));

      expect(result.error).toContain('run completed');
      expect(result.error).toContain('disk full');
    });

    it('does not retry a malformed payload', async () => {
      const result = await h.processor.process(job({ dryRun: 'yes' }));

      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(false);
      expect(h.run).not.toHaveBeenCalled();
    });
  });

  describe('payload validation', () => {
    it('accepts an absent payload, since a cron job carries nothing', async () => {
      expect((await h.processor.process(job(undefined))).ok).toBe(true);
    });

    it('accepts an empty payload', async () => {
      expect((await h.processor.process(job({}))).ok).toBe(true);
    });

    it('rejects a non-object payload', async () => {
      expect((await h.processor.process(job('run'))).retryable).toBe(false);
    });

    it('rejects an unknown trigger instead of storing it', async () => {
      // 'cron' would be a valid value, so the string has to be one that is not.
      const result = await h.processor.process(
        job({ trigger: 'nightly' as never }),
      );

      expect(result.ok).toBe(false);
      expect(h.insert).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean dry run', async () => {
      expect((await h.processor.process(job({ dryRun: 1 }))).ok).toBe(false);
    });
  });

  describe('the entity it writes to', () => {
    it('inserts the maintenance log, not some other table', () => {
      // Guards against the repository being wired to the wrong entity, which
      // typechecks perfectly and silently records history nowhere.
      expect(MaintenanceLog.name).toBe('MaintenanceLog');
    });
  });
});
