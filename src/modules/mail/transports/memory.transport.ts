import { Logger } from '@nestjs/common';

import type {
  MailMessage,
  MailTransport,
  SendResult,
} from './transport.interface.js';

const logger = new Logger('MemoryMailTransport');

/**
 * The development default: keeps every message in memory instead of sending it.
 *
 * A fresh clone can exercise registration, verification and password reset
 * without a provider, a credential or a package. `MAIL_TRANSPORT=memory` is
 * refused in production, where a transport that reports success and delivers
 * nothing is worse than one that fails loudly.
 */
export class MemoryMailTransport implements MailTransport {
  readonly name = 'memory';

  private readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<SendResult> {
    this.sent.push(message);

    logger.log(
      `[mail:${message.mailId}] to=${this.describeRecipients(message.to)} ` +
        `template=${message.template ?? 'none'} subject=${JSON.stringify(message.subject)} (not delivered)`,
    );

    return { accepted: this.recipientsOf(message), rejected: [] };
  }

  /**
   * What has been "sent", for tests and for a local preview.
   *
   * A copy rather than the live array, so a caller cannot clear the log by
   * mutating the result of a read.
   */
  getSent(): readonly MailMessage[] {
    return [...this.sent];
  }

  /** The most recent message for a recipient, which is what a test usually wants. */
  lastTo(recipient: string): MailMessage | undefined {
    return [...this.sent]
      .reverse()
      .find((message) => this.recipientsOf(message).includes(recipient));
  }

  clear(): void {
    this.sent.length = 0;
  }

  private recipientsOf(message: MailMessage): string[] {
    return Array.isArray(message.to) ? message.to : [message.to];
  }

  private describeRecipients(to: MailMessage['to']): string {
    return Array.isArray(to) ? to.join(',') : to;
  }
}
