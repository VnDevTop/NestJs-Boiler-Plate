import { Injectable, Logger } from '@nestjs/common';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { randomUUID } from 'node:crypto';

import { CacheService } from '../cache/index.js';

/**
 * Proves the cache works by writing a value and reading it back.
 *
 * A plain read would report healthy on a dead cache: cache-manager turns a
 * failing store into a miss, so "unreachable" and "empty" look identical. Writing
 * a value only this check knows and comparing it on the way back is what makes
 * the two distinguishable.
 */
@Injectable()
export class CacheHealthIndicator {
  private readonly logger = new Logger(CacheHealthIndicator.name);
  private readonly key = '__health__';

  constructor(private readonly cacheService: CacheService) {}

  async isHealthy(): Promise<HealthIndicatorResult> {
    const token = randomUUID();

    try {
      await this.cacheService.set(this.key, token, { ttl: 60 });
      const value = await this.cacheService.get<string>(this.key);

      if (value !== token) {
        return { cache: { status: 'down', reason: 'read back did not match' } };
      }

      return { cache: { status: 'up' } };
    } catch (error) {
      // Reached only when the failure is thrown rather than reported as a miss.
      this.logger.warn(`Cache health check failed: ${String(error)}`);

      return { cache: { status: 'down' } };
    }
  }
}
