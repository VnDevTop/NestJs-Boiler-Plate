import { registerAs } from '@nestjs/config';

/**
 * Notification settings.
 *
 * Not exported from `configs/index.ts` and not in the `load` array of
 * `app.module.ts`, for the same reason as `mail.config.ts`: it describes
 * optional channels, so it is loaded with `ConfigModule.forFeature()` inside
 * `NotificationModule`.
 *
 * No channel here needs a package. Telegram, Slack and Discord are reached over
 * HTTPS, so this namespace is pure configuration and nothing more.
 */

export type NotificationChannelName =
  'console' | 'telegram' | 'slack' | 'discord';

export interface NotificationConfig {
  /**
   * Master switch. When false every channel is skipped, whatever its own flag
   * says, so an incident can silence notifications without editing four
   * variables.
   */
  enabled: boolean;
  /** Per-channel switches, checked alongside the master switch. */
  channels: Record<NotificationChannelName, boolean>;
  telegram: TelegramOptions;
  slack: SlackOptions;
  discord: DiscordOptions;
  /** Delivery behaviour, applied to every channel. */
  delivery: NotificationDeliveryOptions;
}

/** Mirrors the fields `TelegramChannel` passes to the Bot API. */
export interface TelegramOptions {
  botToken?: string;
  chatId?: string;
  /**
   * Forum topic id, so one bot can route event types to separate rooms. A
   * single chat without topics needs no value here.
   */
  topicId?: string;
}

/** Mirrors the fields `SlackChannel` posts to an incoming webhook. */
export interface SlackOptions {
  /** The incoming webhook url, which already carries the credential. */
  webhookUrl?: string;
  /** Label used in log lines, so a failure names the destination. */
  channel?: string;
}

/** Mirrors the fields the Discord webhook accepts, which is Slack's shape. */
export interface DiscordOptions {
  webhookUrl?: string;
  channel?: string;
}

export interface NotificationDeliveryOptions {
  /** How long to wait for a webhook, in milliseconds. */
  timeout: number;
  /**
   * How many times to retry a delivery. A broken webhook is retried rather than
   * dropped, because a notification is only useful if it arrives.
   */
  retries: number;
  /**
   * Base for the exponential backoff between retries, in milliseconds. The
   * wait before attempt N is this value times 2^(N-1).
   */
  retryDelay: number;
  /**
   * Whether a failed delivery is fatal. Off in practice: a broken webhook must
   * never fail the request that triggered it.
   */
  throwOnFailure: boolean;
}

const flag = (value: string | undefined, fallback = false): boolean =>
  value === undefined ? fallback : value === 'true';

export const notificationConfig = registerAs(
  'notification',
  (): NotificationConfig => ({
    enabled: flag(process.env.NOTIFICATION_ENABLED),
    channels: {
      // The console channel is the development default, so a fresh clone shows
      // what the app would have sent.
      console: flag(process.env.NOTIFICATION_CONSOLE_ENABLED, true),
      telegram: flag(process.env.TELEGRAM_ENABLED),
      slack: flag(process.env.SLACK_ENABLED),
      discord: flag(process.env.DISCORD_ENABLED),
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
      topicId: process.env.TELEGRAM_TOPIC_ID,
    },
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL,
    },
    discord: {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      channel: process.env.DISCORD_CHANNEL,
    },
    delivery: {
      timeout: Number(process.env.NOTIFICATION_TIMEOUT ?? 5_000),
      retries: Number(process.env.NOTIFICATION_RETRIES ?? 2),
      retryDelay: Number(process.env.NOTIFICATION_RETRY_DELAY ?? 1_000),
      throwOnFailure: flag(process.env.NOTIFICATION_THROW_ON_FAILURE),
    },
  }),
);
