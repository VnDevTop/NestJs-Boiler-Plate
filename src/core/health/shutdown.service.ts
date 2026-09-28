import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';

/**
 * Tracks whether the instance is draining.
 *
 * Readiness reports not ready from the first signal, so a load balancer stops
 * sending new requests while in-flight ones finish, instead of dropping them the
 * moment the connections close.
 */
@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownService.name);
  private shuttingDown = false;

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  beginShutdown(): void {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.logger.log('Shutdown started, no longer accepting traffic');
  }

  onApplicationShutdown(): void {
    this.beginShutdown();
    this.logger.log('Shutdown complete');
  }
}
