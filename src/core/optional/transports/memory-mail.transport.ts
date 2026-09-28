import { Logger } from '@nestjs/common';

import type {
  MailMessage,
  MailTransport,
  SendResult,
} from './mail.interface.js';

const logger = new Logger('MailMemoryTransport');

/**
 * The development default: it keeps every message in memory instead of sending
 * it, so a fresh clone works with no credentials and no package installed.
 *
 * It is refused in production, where a silent no-op mailer is worse than a
 * failed one.
 */
export class MemoryMailTransport implements MailTransport {
  readonly name = 'memory';

  private readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<SendResult> {
    this.sent.push(message);
    logger.log(
      `[mail:${message.mailId ?? 'no-id'}] to=${String(message.to)} ` +
        `subject=${JSON.stringify(message.subject)} (not delivered)`,
    );

    return { accepted: this.recipientsOf(message), rejected: [] };
  }

  /** Read-only view for tests and for the local mail preview endpoint. */
  getSent(): readonly MailMessage[] {
    return [...this.sent];
  }

  clear(): void {
    this.sent.length = 0;
  }

  private recipientsOf(message: MailMessage): string[] {
    return Array.isArray(message.to) ? message.to : [message.to];
  }
}
