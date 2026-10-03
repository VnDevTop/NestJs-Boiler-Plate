import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { retentionConfig } from '../../configs/retention.config.js';
import { MaintenanceLog } from './entities/index.js';
import { RetentionProcessor } from './processors/retention.processor.js';
import { RetentionService } from './retention.service.js';

/**
 * Data retention.
 *
 * Owns the config registration, so an app that never enables the job carries
 * none of it, and owns the log entity the processor writes to.
 *
 * Deliberately does not import `QueueModule`. The processor is injected into the
 * queue's router, so this module sits below the queue in the graph; the scheduled
 * entry that enqueues the job in Phase 16 has to sit above it, and importing the
 * queue from here would close the loop. Keeping the direction one way is why the
 * cron provider is not a member of this module.
 */
@Module({
  imports: [
    ConfigModule.forFeature(retentionConfig),
    TypeOrmModule.forFeature([MaintenanceLog]),
  ],
  providers: [RetentionService, RetentionProcessor],
  exports: [RetentionService, RetentionProcessor],
})
export class MaintenanceModule {}
