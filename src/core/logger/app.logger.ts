import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import type { Writable } from 'node:stream';

import { getRequestId } from '../../common/utils/index.js';

export interface AppLoggerOptions {
  levels: LogLevel[];
  stream: Writable;
}

interface LogEntry {
  level: LogLevel;
  context?: string;
  message: unknown;
  requestId?: string;
}

/**
 * Emits one JSON object per line, so a log shipper can parse it without a
 * regex.
 *
 * This is only used in production. Development keeps Nest's own logger, whose
 * coloured output includes the per module load time, and that number is worth
 * more than consistency while you are working. Two formats for two audiences
 * beats one format for neither.
 *
 * The request id is read from the async context rather than passed in, so a log
 * written deep inside a service is correlatable without the call site knowing
 * anything about requests.
 */
export class AppLogger extends ConsoleLogger {
  private readonly settings: AppLoggerOptions;

  constructor(settings: AppLoggerOptions, context?: string) {
    const base = { logLevels: settings.levels, json: false };

    if (context === undefined) {
      super(base);
    } else {
      super(context, base);
    }

    // Assigned here rather than as a constructor parameter property, because
    // TypeScript emits that assignment before the super call above.
    this.settings = settings;
  }

  override log(message: unknown, ...optional: unknown[]): void {
    this.write('log', message, optional);
  }

  override error(message: unknown, ...optional: unknown[]): void {
    this.write('error', message, optional);
  }

  override warn(message: unknown, ...optional: unknown[]): void {
    this.write('warn', message, optional);
  }

  override debug(message: unknown, ...optional: unknown[]): void {
    this.write('debug', message, optional);
  }

  override verbose(message: unknown, ...optional: unknown[]): void {
    this.write('verbose', message, optional);
  }

  private write(level: LogLevel, message: unknown, optional: unknown[]): void {
    if (!this.settings.levels.includes(level)) {
      return;
    }

    this.settings.stream.write(
      `${JSON.stringify(
        this.toEntry({
          level,
          context: this.resolveContext(optional),
          message,
          requestId: getRequestId(),
        }),
      )}\n`,
    );
  }

  private resolveContext(optional: unknown[]): string | undefined {
    const positional = optional.find(
      (value): value is string => typeof value === 'string',
    );

    return positional ?? this.context ?? undefined;
  }

  private toEntry(entry: LogEntry): Record<string, unknown> {
    const context = entry.context ? { context: entry.context } : {};
    const requestId = entry.requestId ? { requestId: entry.requestId } : {};

    return {
      timestamp: new Date().toISOString(),
      level: entry.level,
      ...context,
      ...requestId,
      message:
        entry.message instanceof Error
          ? {
              name: entry.message.name,
              message: entry.message.message,
              stack: entry.message.stack,
            }
          : entry.message,
    };
  }
}

export function createAppLogger(): AppLogger {
  return new AppLogger({
    levels: ['error', 'warn', 'log', 'debug', 'verbose'],
    stream: process.stdout,
  });
}
