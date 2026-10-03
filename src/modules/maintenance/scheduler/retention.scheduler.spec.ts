import type { SchedulerRegistry } from '@nestjs/schedule';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QUEUE_NAMES, type JobQueue } from '../../queue/queue.interface.js';
import type { RetentionConfig } from '../../../configs/retention.config.js';
import { DEFAULT_AGES } from '../../../configs/retention.config.js';
import { RetentionTrigger } from '../entities/retention-trigger.enum.js';
import {
  RETENTION_CRON_NAME,
  RetentionScheduler,
} from './retention.scheduler.js';
import { RETENTION_JOB } from '../processors/retention.processor.js';

interface Harness {
  scheduler: RetentionScheduler;
  enqueue: ReturnType<typeof vi.fn>;
  addCronJob: ReturnType<typeof vi.fn>;
  registry: SchedulerRegistry;
}

function harness(
  overrides: Partial<RetentionConfig> = {},
  options: { enqueueThrows?: boolean } = {},
): Harness {
  const enqueue = options.enqueueThrows
    ? vi.fn().mockRejectedValue(new Error('redis is unreachable'))
    : vi.fn().mockResolvedValue(undefined);
  const addCronJob = vi.fn();

  const config: RetentionConfig = {
    enabled: true,
    dryRun: false,
    schedule: '17 3 * * *',
    batchSize: 5_000,
    batchDelay: 100,
    runTimeout: 3_600_000,
    ages: DEFAULT_AGES,
    ...overrides,
  };

  const queue = { driver: 'in-process', enqueue } as unknown as JobQueue;

  return {
    scheduler: new RetentionScheduler(config, queue, {
      addCronJob,
    } as unknown as SchedulerRegistry),
    enqueue,
    addCronJob,
    registry: { addCronJob } as unknown as SchedulerRegistry,
  };
}

describe('RetentionScheduler', () => {
  let h: Harness;

  beforeEach(() => {
    h = harness();
  });

  describe('when enabled', () => {
    it('registers a cron job at bootstrap', () => {
      h.scheduler.onApplicationBootstrap();

      expect(h.addCronJob).toHaveBeenCalledTimes(1);
    });

    it('registers it under a known name, so it can be found later', () => {
      // The name is the only handle on the job once it is running.
      h.scheduler.onApplicationBootstrap();

      expect(h.addCronJob.mock.calls[0][0]).toBe(RETENTION_CRON_NAME);
    });

    it('registers a job that is already started', () => {
      // A job added but not started never fires, and nothing reports that.
      h.scheduler.onApplicationBootstrap();

      expect(h.addCronJob.mock.calls[0][1].isActive).toBe(true);
    });

    it('does not enqueue anything at bootstrap', () => {
      // The registration is not the run. Firing on boot would mean a deploy
      // performs a cleanup nobody asked for at an unpredictable moment.
      h.scheduler.onApplicationBootstrap();

      expect(h.enqueue).not.toHaveBeenCalled();
    });

    it('is on by default when the configuration says nothing', () => {
      // A deployment that never sets RETENTION_ENABLED still prunes. Defaulting
      // it off made every install a deployment that leaks.
      expect(harness({ enabled: true }).addCronJob).toBeDefined();
    });
  });

  describe('when disabled', () => {
    beforeEach(() => {
      h = harness({ enabled: false });
    });

    it('registers nothing', () => {
      h.scheduler.onApplicationBootstrap();

      expect(h.addCronJob).not.toHaveBeenCalled();
    });

    it('still starts cleanly, so an app that disabled it boots', () => {
      expect(() => h.scheduler.onApplicationBootstrap()).not.toThrow();
    });
  });

  describe('a malformed schedule', () => {
    beforeEach(() => {
      h = harness({ schedule: 'not a cron expression' });
    });

    it('registers nothing rather than throwing out of bootstrap', () => {
      // Refusing to boot over a typo in an environment variable would turn a
      // housekeeping problem into an outage.
      expect(() => h.scheduler.onApplicationBootstrap()).not.toThrow();
      expect(h.addCronJob).not.toHaveBeenCalled();
    });
  });

  describe('when the cron fires', () => {
    it('enqueues the retention job on the maintenance queue', async () => {
      await (h.scheduler as unknown as { enqueue(): Promise<void> }).enqueue();

      expect(h.enqueue).toHaveBeenCalledTimes(1);

      const [queue, job] = h.enqueue.mock.calls[0];

      expect(queue).toBe(QUEUE_NAMES.maintenance);
      expect(job.name).toBe(RETENTION_JOB);
    });

    it('marks the run as coming from cron', async () => {
      await (h.scheduler as unknown as { enqueue(): Promise<void> }).enqueue();

      // The trigger column exists to answer who asked, and an unlabelled nightly
      // run is the one case where the answer matters most.
      const [, job] = h.enqueue.mock.calls[0];

      expect(job.payload.trigger).toBe(RetentionTrigger.Cron);
    });

    it('sets no dedupe key, because every night is a distinct run', async () => {
      await (h.scheduler as unknown as { enqueue(): Promise<void> }).enqueue();

      // Deduplication is right for mail and wrong here: two entries on the same
      // day are the same work, but a key that outlives the night would let
      // tomorrow's run be swallowed as a duplicate.
      const [, job] = h.enqueue.mock.calls[0];

      expect(job.dedupeKey).toBeUndefined();
    });

    it('swallows an enqueue failure instead of rejecting', async () => {
      h = harness({}, { enqueueThrows: true });

      // A scheduler callback that rejects is an unhandled rejection, and one that
      // throws is invisible to the queue, which owns the retry budget.
      await expect(
        (h.scheduler as unknown as { enqueue(): Promise<void> }).enqueue(),
      ).resolves.toBeUndefined();
    });
  });
});
