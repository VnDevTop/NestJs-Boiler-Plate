import { Module } from '@nestjs/common';

import { QueueModule } from '../queue/index.js';
import { RetentionScheduler } from './scheduler/retention.scheduler.js';

/**
 * The scheduled entry point for retention.
 *
 * Exists as its own module because it has to sit above `QueueModule` in the
 * import graph: it enqueues through `JOB_QUEUE`, while `QueueModule` imports
 * `MaintenanceModule` to get the processor that runs the job. Putting this
 * provider in `MaintenanceModule` would close that loop, and `forwardRef` would
 * hide the loop rather than remove it.
 *
 * Separate from `MaintenanceModule` on purpose, so the cost of this one is paid
 * by an app that never schedules anything: `MaintenanceModule` still works on its
 * own for the admin route, and this module is what an application imports when it
 * wants the job to fire by itself.
 */
@Module({
  imports: [QueueModule],
  providers: [RetentionScheduler],
  exports: [RetentionScheduler],
})
export class MaintenanceSchedulerModule {}
