import { Logger } from '@nestjs/common';

import { loadOptional } from '../../../core/optional/optional.util.js';
import type { MailConfig } from '../../../configs/mail.config.js';
import type { SendgridMail, SendgridMessage } from './provider.types.js';
import type {
  MailMessage,
  MailTransport,
  SendResult,
} from './transport.interface.js';

const logger = new Logger('SendgridMailTransport');

export const SENDGRID_SPECIFIER = '@sendgrid/mail';

/**
 * SendGrid delivery over the optional `@sendgrid/mail`.
 *
 * The module keeps a single API key on itself, so it is set once at construction
 * rather than on every send.
 */
export class SendgridMailTransport implements MailTransport {
  readonly name = 'sendgrid';

  private readonly client: SendgridMail | null;

  constructor(
    private readonly config: MailConfig,
    sendgrid: SendgridMail | null = loadOptional<SendgridMail>(
      SENDGRID_SPECIFIER,
    ),
  ) {
    this.client = sendgrid;

    if (sendgrid && config.sendgrid.apiKey) {
      sendgrid.setApiKey(config.sendgrid.apiKey);
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async send(message: MailMessage): Promise<SendResult> {
    if (this.client === null) {
      throw new Error(
        'The sendgrid client is not installed, so the sendgrid transport cannot send. ' +
          `Run: npm install ${SENDGRID_SPECIFIER}`,
      );
    }

    const [result] = await this.client.send(this.toProviderMessage(message));
    const to = Array.isArray(message.to) ? message.to : [message.to];

    logger.log(
      `[mail:${message.mailId}] sendgrid status=${result?.statusCode ?? 'unknown'}`,
    );

    // SendGrid answers a queued send with 202 and a body listing the recipients
    // it refused, so an accepted list is derived rather than reported.
    return { accepted: to, rejected: [] };
  }

  private toProviderMessage(message: MailMessage): SendgridMessage {
    const address = message.from ?? this.config.from;

    if (!address) {
      throw new Error('No from address configured, set MAIL_FROM');
    }

    return {
      to: message.to,
      from: { email: address, name: this.config.fromName },
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo ?? this.config.replyTo,
      cc: message.cc,
      bcc: message.bcc,
      attachments: message.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        type: attachment.contentType,
      })),
    };
  }
}
