import { Logger } from '@nestjs/common';

import { loadOptional } from '../../../core/optional/optional.util.js';
import type { MailConfig } from '../../../configs/mail.config.js';
import type {
  SesClient,
  SesModule,
  SesSendEmailInput,
} from './provider.types.js';
import type {
  MailMessage,
  MailTransport,
  SendResult,
} from './transport.interface.js';

const logger = new Logger('SesMailTransport');

export const SES_SPECIFIER = '@aws-sdk/client-sesv2';

/**
 * Amazon SES delivery over the optional `@aws-sdk/client-sesv2`.
 *
 * The AWS client is constructed once and kept, because a client owns a
 * connection pool; building one per message would reconnect on every send.
 */
export class SesMailTransport implements MailTransport {
  readonly name = 'ses';

  private readonly client: SesClient | null;

  constructor(
    private readonly config: MailConfig,
    sesModule: SesModule | null = loadOptional<SesModule>(SES_SPECIFIER),
  ) {
    this.client = sesModule
      ? new sesModule.SESv2Client({ region: config.ses.region })
      : null;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async send(message: MailMessage): Promise<SendResult> {
    if (this.client === null) {
      throw new Error(
        'The aws ses client is not installed, so the ses transport cannot send. ' +
          `Run: npm install ${SES_SPECIFIER}`,
      );
    }

    const input = this.toInput(message);
    const result = await this.client.send(input);
    const to = Array.isArray(message.to) ? message.to : [message.to];

    logger.log(`[mail:${message.mailId}] ses accepted=${to.length}`);

    return { accepted: to, rejected: [], providerId: result.MessageId };
  }

  /**
   * SES takes a structured body rather than the parts nodemailer takes, so the
   * conversion happens once here instead of in the service.
   */
  private toInput(message: MailMessage): SesSendEmailInput {
    const to = Array.isArray(message.to) ? message.to : [message.to];

    return {
      FromEmailAddress: message.from ?? this.config.from,
      Destination: {
        ToAddresses: to,
        CcAddresses: message.cc,
        BccAddresses: message.bcc,
      },
      ReplyToAddresses: message.replyTo
        ? [message.replyTo]
        : this.config.replyTo
          ? [this.config.replyTo]
          : undefined,
      Content: {
        Simple: {
          Subject: { Data: message.subject },
          Body: {
            Text: { Data: message.text },
            Html: message.html ? { Data: message.html } : undefined,
          },
        },
      },
    };
  }
}
