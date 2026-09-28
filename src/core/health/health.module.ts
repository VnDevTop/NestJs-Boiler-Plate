import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TerminusModule,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { Public } from '../../common/decorators/index.js';
import { CacheHealthIndicator } from './cache.health.js';
import { ShutdownService } from './shutdown.service.js';

/**
 * Liveness and readiness are separate on purpose. Liveness must stay green while
 * a dependency is down, because a failing liveness probe makes an orchestrator
 * restart every healthy instance at exactly the wrong moment. Readiness is the
 * one that goes red, so traffic is diverted without a restart.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly cache: CacheHealthIndicator,
    private readonly shutdown: ShutdownService,
  ) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  ready() {
    if (this.shutdown.isShuttingDown) {
      throw new ServiceUnavailableException('Shutting down');
    }

    return this.health.check([
      () => this.database.pingCheck('database'),
      () => this.cache.isHealthy(),
    ]);
  }

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.database.pingCheck('database'),
      () => this.cache.isHealthy(),
    ]);
  }
}

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [CacheHealthIndicator, ShutdownService],
  exports: [ShutdownService],
})
export class HealthModule {}
