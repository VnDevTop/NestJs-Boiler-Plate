import { describe, expect, it, vi } from 'vitest';

import type { MailConfig } from '../../../configs/mail.config.js';
import type { Nodemailer, NodemailerMessage } from './provider.types.js';
import { SmtpMailTransport } from './smtp.transport.js';
import type { MailMessage } from './transport.interface.js';

const config: MailConfig = {
  transport: 'smtp',
  fromName: 'Example',
  from: 'no-reply@example.com',
  subjectPrefix: '',
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    username: 'user',
    password: 'secret',
  },
  sendgrid: {},
  ses: {},
  timeouts: { connection: 5000, socket: 10000 },
};

const message: MailMessage = {
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'plain',
  html: '<p>html</p>',
  mailId: 'mail-1',
  template: 'welcome',
};

function fakeNodemailer() {
  const sendMail = vi.fn().mockResolvedValue({
    messageId: 'provider-1',
    accepted: ['user@example.com'],
    rejected: [],
  });
  const close = vi.fn();
  const createTransport = vi.fn().mockReturnValue({ sendMail, close });

  return {
    client: { createTransport } as unknown as Nodemailer,
    createTransport,
    sendMail,
    close,
  };
}

describe('SmtpMailTransport', () => {
  it('reports itself unavailable when the package is missing', () => {
    expect(new SmtpMailTransport(config, null).isAvailable()).toBe(false);
  });

  it('reports itself available once the package resolves', () => {
    const { client } = fakeNodemailer();

    expect(new SmtpMailTransport(config, client).isAvailable()).toBe(true);
  });

  it('names itself for the health check', () => {
    expect(new SmtpMailTransport(config, null).name).toBe('smtp');
  });

  it('throws with the install command when used without the package', async () => {
    // The service checks isAvailable() and falls back, so reaching this is a
    // wiring bug rather than a normal condition.
    await expect(
      new SmtpMailTransport(config, null).send(message),
    ).rejects.toThrow(/npm install nodemailer/);
  });

  it('builds the transport from the config, including timeouts', async () => {
    const { client, createTransport } = fakeNodemailer();
    await new SmtpMailTransport(config, client).send(message);

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      connectionTimeout: 5000,
      socketTimeout: 10000,
      auth: { user: 'user', pass: 'secret' },
    });
  });

  it('omits auth entirely when no credential is set', async () => {
    // An empty auth object makes some servers answer with an auth prompt
    // instead of sending, which looks like a network failure.
    const { client, createTransport } = fakeNodemailer();
    const anonymous: MailConfig = {
      ...config,
      smtp: { ...config.smtp, username: undefined, password: undefined },
    };

    await new SmtpMailTransport(anonymous, client).send(message);

    expect(createTransport.mock.calls[0][0].auth).toBeUndefined();
  });

  it('sends the from name with the address', async () => {
    const { client, sendMail } = fakeNodemailer();
    await new SmtpMailTransport(config, client).send(message);

    expect((sendMail.mock.calls[0][0] as NodemailerMessage).from).toBe(
      '"Example" <no-reply@example.com>',
    );
  });

  it('passes both parts of the body through', async () => {
    const { client, sendMail } = fakeNodemailer();
    await new SmtpMailTransport(config, client).send(message);

    expect(sendMail.mock.calls[0][0]).toMatchObject({
      text: 'plain',
      html: '<p>html</p>',
    });
  });

  it('returns the provider id so a delivery can be traced', async () => {
    const { client } = fakeNodemailer();

    const result = await new SmtpMailTransport(config, client).send(message);

    expect(result).toEqual({
      accepted: ['user@example.com'],
      rejected: [],
      providerId: 'provider-1',
    });
  });

  it('closes the connection, so a send does not leak a socket', async () => {
    const { client, close } = fakeNodemailer();
    await new SmtpMailTransport(config, client).send(message);

    expect(close).toHaveBeenCalled();
  });

  it('closes the connection even when the send fails', async () => {
    const { client, close, sendMail } = fakeNodemailer();
    sendMail.mockRejectedValue(new Error('connection refused'));

    await expect(
      new SmtpMailTransport(config, client).send(message),
    ).rejects.toThrow('connection refused');
    expect(close).toHaveBeenCalled();
  });

  it('refuses to send with no from address at all', async () => {
    const { client } = fakeNodemailer();
    const { from: _from, ...withoutFrom } = config;

    await expect(
      new SmtpMailTransport(withoutFrom, client).send(message),
    ).rejects.toThrow(/MAIL_FROM/);
  });

  it('lets a per-message from address win over the config', async () => {
    const { client, sendMail } = fakeNodemailer();
    await new SmtpMailTransport(config, client).send({
      ...message,
      from: 'other@example.com',
    });

    expect(sendMail.mock.calls[0][0].from).toContain('other@example.com');
  });
});
