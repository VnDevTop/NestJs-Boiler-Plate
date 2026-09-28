import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';

import { postJson } from './json-poster.js';
import type {
  WebhookChannel,
  WebhookPayload,
  WebhookResult,
} from './webhook.interface.js';

const logger = new Logger('SlackChannel');

export interface SlackChannelOptions {
  /** Incoming webhook url, which already carries the credential. */
  webhookUrl: string;
  timeoutMs?: number;
  /** Channel label used in the log line. */
  channel?: string;
}

/**
 * Slack incoming webhook over `HttpService`, no package of its own.
 *
 * The same shape serves Discord, which also accepts a Slack-compatible
 * `{ text }` payload, so the two share one implementation.
 */
export class SlackChannel implements WebhookChannel {
  readonly name = 'slack';

  constructor(
    private readonly http: HttpService,
    private readonly options: SlackChannelOptions,
  ) {}

  async send(payload: WebhookPayload): Promise<WebhookResult> {
    const response = await postJson(this.http, {
      url: this.options.webhookUrl,
      body: this.blockKit(payload),
      timeoutMs: this.options.timeoutMs,
    });

    if (response.status < 200 || response.status >= 300) {
      logger.error(
        `Webhook ${this.options.channel ?? this.name} rejected the message: ${response.status}`,
      );
      return { delivered: false, status: response.status };
    }

    return { delivered: true, status: response.status };
  }

  /**
   * Slack shows a bold line for the event and a plain paragraph for the
   * detail, which is enough structure without the full Block Kit surface.
   */
  private blockKit(payload: WebhookPayload): unknown {
    const blocks: unknown[] = [];

    if (payload.title) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*${payload.title}*` },
      });
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: payload.text },
    });

    return { text: payload.title ?? payload.text, blocks };
  }
}
