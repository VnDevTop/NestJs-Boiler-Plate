import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceLog } from '../maintenance/entities/maintenance-log.entity.js';
import { RetentionTrigger } from '../maintenance/entities/retention-trigger.enum.js';
import type {
  RetentionRunResult,
  RetentionService,
} from '../maintenance/retention.service.js';
import { RETENTION_JOB } from '../maintenance/processors/retention.processor.js';
import { QUEUE_NAMES, type JobQueue } from '../queue/queue.interface.js';
import { AdminRetentionController } from './retention.controller.js';

const RUN: RetentionRunResult = {
  dryRun: true,
  startedAt: '2026-10-03T03:17:00.000Z',
  durationMs: 1_234,
  timedOut: false,
  pending: [],
  totalDeleted: 0,
  failed: [],
  targets: [],
};

function entry(overrides: Partial<MaintenanceLog> = {}): MaintenanceLog {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    startedAt: new Date('2026-10-03T03:17:00.000Z'),
    finishedAt: new Date('2026-10-03T03:17:01.234Z'),
    durationMs: 1_234,
    dryRun: true,
    totalDeleted: 0,
    timedOut: false,
    trigger: RetentionTrigger.Admin,
    pending: [],
    failedTargets: [],
    targets: [],
    createdAt: new Date('2026-10-03T03:17:01.234Z'),
    ...overrides,
  } as MaintenanceLog;
}

interface Harness {
  controller: AdminRetentionController;
  run: ReturnType<typeof vi.fn>;
  record: ReturnType<typeof vi.fn>;
  history: ReturnType<typeof vi.fn>;
  latest: ReturnType<typeof vi.fn>;
  enqueue: ReturnType<typeof vi.fn>;
}

function harness(
  options: { latestFound?: MaintenanceLog | null } = {},
): Harness {
  const run = vi.fn().mockResolvedValue(RUN);
  const record = vi.fn().mockImplementation(async () => entry());
  const history = vi.fn().mockResolvedValue({ items: [entry()], total: 1 });
  const latest = vi.fn().mockResolvedValue(options.latestFound ?? entry());
  const enqueue = vi.fn().mockResolvedValue(undefined);

  const controller = new AdminRetentionController(
    { run, record, history, latest } as unknown as RetentionService,
    { driver: 'in-process', enqueue } as unknown as JobQueue,
  );

  return { controller, run, record, history, latest, enqueue };
}

describe('AdminRetentionController', () => {
  let h: Harness;

  beforeEach(() => {
    h = harness();
  });

  describe('POST admin/retention/dry-run', () => {
    it('forces a dry run regardless of configuration', async () => {
      await h.controller.dryRun();

      // The route exists to rehearse. A deployment configured to delete must not
      // be able to turn an operator's rehearsal into a real deletion.
      expect(h.run).toHaveBeenCalledWith({ dryRun: true });
    });

    it('records the rehearsal, labelled as an admin run', async () => {
      await h.controller.dryRun();

      // Otherwise a rehearsal leaves no trace and cannot be told apart from one
      // that never happened.
      expect(h.record).toHaveBeenCalledWith(RUN, RetentionTrigger.Admin);
    });

    it('answers from the row it wrote, so the id is real', async () => {
      h.record.mockResolvedValue(entry({ id: 'dry-run-id' }));

      const result = await h.controller.dryRun();

      expect(result.id).toBe('dry-run-id');
    });

    it('returns the counts the operator asked for', async () => {
      h.record.mockResolvedValue(entry({ totalDeleted: 0, dryRun: true }));

      const result = await h.controller.dryRun();

      expect(result.dryRun).toBe(true);
      expect(result.totalDeleted).toBe(0);
      expect(result.durationMs).toBe(1_234);
    });

    it('surfaces a timeout in the response', async () => {
      h.record.mockResolvedValue(
        entry({ timedOut: true, pending: ['user-devices'] }),
      );

      const result = await h.controller.dryRun();

      expect(result.timedOut).toBe(true);
      expect(result.pending).toEqual(['user-devices']);
    });

    it('reports a failed target rather than hiding it', async () => {
      h.record.mockResolvedValue(entry({ failedTargets: ['refresh-tokens'] }));

      expect((await h.controller.dryRun()).failedTargets).toEqual([
        'refresh-tokens',
      ]);
    });

    it('does not queue anything, because it already ran', async () => {
      await h.controller.dryRun();

      expect(h.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('POST admin/retention/run', () => {
    it('queues the job instead of running it', async () => {
      await h.controller.run();

      // A real run deletes in batches with pauses and can take minutes, which is
      // longer than a request should stay open.
      expect(h.run).not.toHaveBeenCalled();
      expect(h.enqueue).toHaveBeenCalledTimes(1);
    });

    it('queues it on the maintenance queue under the right name', async () => {
      await h.controller.run();

      const [queue, job] = h.enqueue.mock.calls[0];

      expect(queue).toBe(QUEUE_NAMES.maintenance);
      expect(job.name).toBe(RETENTION_JOB);
    });

    it('labels the run as coming from an admin', async () => {
      await h.controller.run();

      const [, job] = h.enqueue.mock.calls[0];

      expect(job.payload.trigger).toBe(RetentionTrigger.Admin);
    });

    it('does not force dryRun, so the run really deletes', async () => {
      await h.controller.run();

      const [, job] = h.enqueue.mock.calls[0];

      // Left undefined on purpose: forcing false would override a deployment
      // deliberately configured to rehearse only.
      expect(job.payload.dryRun).toBeUndefined();
    });

    it('points at where the outcome will appear', async () => {
      const result = await h.controller.run();

      expect(result.queued).toBe(true);
      expect(result.see).toBe('/admin/retention/runs/latest');
    });
  });

  describe('GET admin/retention/runs', () => {
    it('returns the newest runs first', async () => {
      await h.controller.history();

      // Asserted on the arguments because ordering is the service's job and this
      // route's only contract is the page size it passes down.
      expect(h.history).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('returns the items and the total separately', async () => {
      const result = await h.controller.history();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('reports a total larger than the page', async () => {
      h.history.mockResolvedValue({ items: [entry()], total: 128 });

      expect((await h.controller.history()).total).toBe(128);
    });

    it('caps a page size that asks for too much', async () => {
      await h.controller.history('999999');

      expect(h.history).toHaveBeenCalledWith({ limit: 100, offset: 0 });
    });

    it('falls back to the default for a nonsense limit', async () => {
      await h.controller.history('lots');

      expect(h.history).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('falls back to the default for a negative limit', async () => {
      await h.controller.history('-5');

      expect(h.history).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('falls back for a zero limit, which would return nothing at all', async () => {
      await h.controller.history('0');

      expect(h.history).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('passes an offset through so an operator can page backwards', async () => {
      await h.controller.history('10', '40');

      expect(h.history).toHaveBeenCalledWith({ limit: 10, offset: 40 });
    });

    it('treats a negative offset as the start', async () => {
      await h.controller.history('10', '-1');

      expect(h.history).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    });

    it('handles an empty history', async () => {
      h.history.mockResolvedValue({ items: [], total: 0 });

      expect(await h.controller.history()).toEqual({ items: [], total: 0 });
    });
  });

  describe('GET admin/retention/runs/latest', () => {
    it('returns the most recent run', async () => {
      h.latest.mockResolvedValue(entry({ id: 'latest-id' }));

      expect((await h.controller.latest())?.id).toBe('latest-id');
    });

    it('returns null rather than an empty run when nothing has run', async () => {
      h.latest.mockResolvedValue(null);

      // An app that only just enabled retention has genuinely never run it, and a
      // response shaped like a run full of zeroes would read as one that found
      // nothing.
      expect(await h.controller.latest()).toBeNull();
    });

    it('formats the timestamps as ISO strings', async () => {
      const result = await h.controller.latest();

      expect(result?.startedAt).toBe('2026-10-03T03:17:00.000Z');
      expect(result?.finishedAt).toBe('2026-10-03T03:17:01.234Z');
    });

    it('copies the lists so a caller cannot mutate the stored row', async () => {
      const pending = ['a'];
      const failedTargets = ['b'];
      h.latest.mockResolvedValue(entry({ pending, failedTargets }));

      const result = await h.controller.latest();

      // Identity, not equality. Two arrays with the same contents would pass an
      // equality check while leaving the caller's push writing into history.
      expect(result?.pending).toEqual(pending);
      expect(result?.pending).not.toBe(pending);
      expect(result?.failedTargets).not.toBe(failedTargets);
    });

    it('copies the per-target cascade lists for the same reason', async () => {
      const cascades = ['refresh_tokens'];
      h.latest.mockResolvedValue(
        entry({
          targets: [
            {
              id: 'users',
              table: 'users',
              description: 'soft-deleted users',
              ageDays: 30,
              deleted: 5,
              batches: 1,
              durationMs: 10,
              cascades,
            },
          ],
        }),
      );

      const result = await h.controller.latest();

      expect(result?.targets[0]?.cascades).toEqual(cascades);
      expect(result?.targets[0]?.cascades).not.toBe(cascades);
    });
  });
});
