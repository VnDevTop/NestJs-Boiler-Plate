import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { notificationConfig } from './notification.config.js';

const KEYS = [
  'NOTIFICATION_ENABLED',
  'NOTIFICATION_CONSOLE_ENABLED',
  'TELEGRAM_ENABLED',
  'SLACK_ENABLED',
  'DISCORD_ENABLED',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_TOPIC_ID',
  'SLACK_WEBHOOK_URL',
  'SLACK_CHANNEL',
  'DISCORD_WEBHOOK_URL',
  'DISCORD_CHANNEL',
  'NOTIFICATION_TIMEOUT',
  'NOTIFICATION_RETRIES',
  'NOTIFICATION_RETRY_DELAY',
  'NOTIFICATION_THROW_ON_FAILURE',
] as const;

beforeEach(() => {
  for (const key of KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    delete process.env[key];
  }
});

describe('notificationConfig', () => {
  it('is off by default, so a fresh clone sends nothing', () => {
    expect(notificationConfig().enabled).toBe(false);
  });

  it('leaves the webhook channels off unless they are turned on', () => {
    expect(notificationConfig().channels).toMatchObject({
      telegram: false,
      slack: false,
      discord: false,
    });
  });

  it('enables the console channel by default, so local work is visible', () => {
    expect(notificationConfig().channels.console).toBe(true);
  });

  it('treats an explicit false as off, which is why the default is opt-in', () => {
    process.env.NOTIFICATION_ENABLED = 'false';
    process.env.TELEGRAM_ENABLED = 'false';

    const config = notificationConfig();

    expect(config.enabled).toBe(false);
    expect(config.channels.telegram).toBe(false);
  });

  it('turns each channel on independently', () => {
    process.env.TELEGRAM_ENABLED = 'true';
    process.env.SLACK_ENABLED = 'true';

    expect(notificationConfig().channels).toMatchObject({
      telegram: true,
      slack: true,
      discord: false,
    });
  });

  it('reads the telegram credentials and topic', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.TELEGRAM_CHAT_ID = '-100123';
    process.env.TELEGRAM_TOPIC_ID = '42';

    expect(notificationConfig().telegram).toEqual({
      botToken: 'token',
      chatId: '-100123',
      topicId: '42',
    });
  });

  it('treats an absent topic as a single chat rather than an error', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';

    expect(notificationConfig().telegram.topicId).toBeUndefined();
  });

  it('keeps the webhook urls unset until a channel needs them', () => {
    expect(notificationConfig().slack.webhookUrl).toBeUndefined();
    expect(notificationConfig().discord.webhookUrl).toBeUndefined();
  });

  it('defaults a failure to a log, never a failed request', () => {
    expect(notificationConfig().delivery.throwOnFailure).toBe(false);
  });

  it('reads the delivery numbers', () => {
    process.env.NOTIFICATION_TIMEOUT = '9000';
    process.env.NOTIFICATION_RETRIES = '4';
    process.env.NOTIFICATION_RETRY_DELAY = '250';

    expect(notificationConfig().delivery).toEqual({
      timeout: 9000,
      retries: 4,
      retryDelay: 250,
      throwOnFailure: false,
    });
  });
});
