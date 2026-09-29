import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mailConfig, type MailTransportName } from './mail.config.js';

function read(): ReturnType<typeof mailConfig> {
  return mailConfig();
}

const KEYS = [
  'MAIL_TRANSPORT',
  'MAIL_FROM',
  'MAIL_FROM_NAME',
  'MAIL_REPLY_TO',
  'MAIL_SUBJECT_PREFIX',
  'MAIL_SMTP_HOST',
  'MAIL_SMTP_PORT',
  'MAIL_SMTP_SECURE',
  'MAIL_SMTP_USER',
  'MAIL_SMTP_PASSWORD',
  'MAIL_SENDGRID_API_KEY',
  'MAIL_SES_REGION',
  'MAIL_CONNECTION_TIMEOUT',
  'MAIL_SOCKET_TIMEOUT',
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

describe('mailConfig', () => {
  it('defaults to the memory transport, so a fresh clone sends nothing', () => {
    expect(read().transport).toBe('memory');
  });

  it('leaves the from address unset rather than inventing one', () => {
    // A guessed from address is how mail ends up attributed to a stranger.
    expect(read().from).toBeUndefined();
  });

  it('reads every documented variable', () => {
    process.env.MAIL_TRANSPORT = 'smtp';
    process.env.MAIL_FROM = 'no-reply@example.com';
    process.env.MAIL_FROM_NAME = 'Example';
    process.env.MAIL_REPLY_TO = 'support@example.com';
    process.env.MAIL_SUBJECT_PREFIX = '[Example]';
    process.env.MAIL_SMTP_HOST = 'smtp.example.com';
    process.env.MAIL_SMTP_PORT = '2525';
    process.env.MAIL_SMTP_USER = 'user';
    process.env.MAIL_SMTP_PASSWORD = 'secret';
    process.env.MAIL_CONNECTION_TIMEOUT = '5000';
    process.env.MAIL_SOCKET_TIMEOUT = '15000';

    const mail = read();

    expect(mail).toMatchObject({
      transport: 'smtp',
      from: 'no-reply@example.com',
      fromName: 'Example',
      replyTo: 'support@example.com',
      subjectPrefix: '[Example]',
      smtp: {
        host: 'smtp.example.com',
        port: 2525,
        username: 'user',
        password: 'secret',
      },
      timeouts: { connection: 5000, socket: 15000 },
    });
  });

  it('falls back to memory for an unknown transport name', () => {
    // The type forbids this, which is why env.validation rejects it too; the
    // config still has to degrade rather than hand back a value it cannot type.
    process.env.MAIL_TRANSPORT = 'carrier-pigeon' as MailTransportName;

    expect(read().transport).toBe('memory');
  });

  it('accepts each documented provider', () => {
    for (const name of ['ses', 'sendgrid'] as const) {
      process.env.MAIL_TRANSPORT = name;
      expect(read().transport).toBe(name);
    }
  });

  it('assumes implicit tls on port 465 and starttls on 587', () => {
    process.env.MAIL_SMTP_PORT = '465';
    expect(read().smtp.secure).toBe(true);

    process.env.MAIL_SMTP_PORT = '587';
    expect(read().smtp.secure).toBe(false);
  });

  it('lets an explicit secure flag win over the port guess', () => {
    process.env.MAIL_SMTP_PORT = '465';
    process.env.MAIL_SMTP_SECURE = 'false';

    expect(read().smtp.secure).toBe(false);
  });

  it('keeps the provider credentials optional until a provider needs them', () => {
    expect(read().sendgrid.apiKey).toBeUndefined();
    expect(read().ses.region).toBeUndefined();
  });
});
