import { Injectable, Logger } from '@nestjs/common';

import { MailService, type SendMailResult } from '../../mail/index.js';
import type {
  TemplateDataByName,
  TemplateName,
} from '../../mail/templates/index.js';
import type { Job, JobResult } from '../queue.interface.js';

/** The one job name this processor answers to. */
export const MAIL_JOB = 'mail.send';

/**
 * What a mail job carries.
 *
 * A template name and its data, never a rendered message: rendering here would
 * mean the body is built at enqueue time, so a template edited between the enqueue
 * and the run would be sent with the old text, and a malformed template would fail
 * the request instead of the job.
 *
 * `data` is typed per template through `MailTemplateData`, so the payload for
 * `reset-password` cannot be the payload for `welcome`.
 */
export interface MailJobPayload {
  to: string;
  template: TemplateName;
  data: TemplateDataByName[TemplateName];
  subjectPrefix?: string;
  replyTo?: string;
}

/**
 * The single implementation of sending mail.
 *
 * Both dispatchers call this: BullMQ's worker and the in-process limiter. That is
 * the whole reason it is a plain class with no queue type anywhere in its
 * signature. Two implementations of a send is how a bug reaches production through
 * the path nobody tested, and the fallback is exactly the path that is off in
 * development and on in an incident.
 */
@Injectable()
export class MailProcessor {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {}

  /** True for the job name this processor handles, so routing stays in one place. */
  static handles(name: string): boolean {
    return name === MAIL_JOB;
  }

  /**
   * Sends one message.
   *
   * Never throws. A throw is how a queue backend learns to retry, which is right
   * for a fault nobody classified, but it also means an unexpected error is
   * retried as if it were a network blip. So the classification happens here, where
   * the provider response is still visible, and the answer is returned.
   */
  async process(job: Job<MailJobPayload>): Promise<JobResult> {
    const payload = this.validate(job.payload);

    if (payload === null) {
      // Retrying a malformed payload can only produce the same malformed payload.
      return {
        ok: false,
        error: `Malformed ${MAIL_JOB} payload`,
        retryable: false,
      };
    }

    try {
      return this.toJobResult(await this.send(payload));
    } catch (error) {
      // MailService swallows provider failures, so a throw here came from
      // somewhere else: a template bug, or a dependency that rejected. It is left
      // retryable, because the alternative is to discard real work over a fault
      // nobody has classified yet, and a rejected promise in the in-process
      // dispatcher would be an unhandled rejection.
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Mail job ${job.name} threw: ${message}`);

      return { ok: false, error: message, retryable: true };
    }
  }

  private validate(payload: unknown): MailJobPayload | null {
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const { to, template, data } = payload as Partial<MailJobPayload>;

    if (typeof to !== 'string' || to.trim() === '') {
      return null;
    }

    if (
      typeof template !== 'string' ||
      typeof data !== 'object' ||
      data === null
    ) {
      return null;
    }

    return { ...(payload as MailJobPayload), to: to.trim() };
  }

  private async send(payload: MailJobPayload): Promise<SendMailResult> {
    return this.mailService.sendTemplate(
      payload.to,
      payload.template,
      payload.data as never,
      { subjectPrefix: payload.subjectPrefix, replyTo: payload.replyTo },
    );
  }

  /**
   * Turns a send outcome into a job outcome.
   *
   * The important line is the last one. A provider 4xx answers the same way every
   * time, so retrying spends the whole budget and delays the dead-letter entry that
   * would tell an operator a credential or a domain is wrong. `MailService`
   * swallows the error so a registration never becomes a 500, which means the
   * classification has to travel back out with the result.
   */
  private toJobResult(result: SendMailResult): JobResult {
    if (result.delivered) {
      return { ok: true };
    }

    this.logger.error(
      `Mail job failed for ${result.template}: ` +
        `${result.error ?? 'no reason given'}` +
        (result.status === undefined ? '' : ` (status ${result.status})`) +
        (result.permanent === true ? ' [permanent]' : ''),
    );

    return {
      ok: false,
      error: result.error ?? 'delivery failed',
      retryable: result.permanent !== true,
    };
  }
}
