import { describe, expect, it, vi } from 'vitest';

import type { MailConfig } from '../../../configs/mail.config.js';
import type {
  SesClient,
  SesModule,
  SesSendEmailInput,
} from './provider.types.js';
import { SesMailTransport } from './ses.transport.js';
import type { MailMessage } from './transport.interface.js';

const config: MailConfig = {
  transport: 'ses',
  fromName: 'Example',
  from: 'no-reply@example.com',
  subjectPrefix: '',
  smtp: {
    host: 'localhost',
    port: 587,
    secure: false,
  },
  sendgrid: {},
  ses: { region: 'eu-west-1' },
  timeouts: { connection: 5000, socket: 10000 },
};

const message: MailMessage = {
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'plain',
  html: '<p>html</p>',
  mailId: 'mail-1',
};

function fakeSes() {
  const send = vi.fn().mockResolvedValue({ MessageId: 'ses-1' });
  const SESv2Client = vi.fn().mockImplementation(function (this: unknown) {
    return { send, destroy: vi.fn() } satisfies SesClient;
  });

  return {
    module: { SESv2Client } as unknown as SesModule,
    send,
    SESv2Client,
  };
}

describe('SesMailTransport', () => {
  it('reports itself unavailable when the package is missing', () => {
    expect(new SesMailTransport(config, null).isAvailable()).toBe(false);
  });

  it('constructs the client once, since it owns a connection pool', () => {
    const { module, SESv2Client } = fakeSes();
    new SesMailTransport(config, module);

    expect(SESv2Client).toHaveBeenCalledTimes(1);
    expect(SESv2Client).toHaveBeenCalledWith({ region: 'eu-west-1' });
  });

  it('throws with the install command when used without the package', async () => {
    await expect(
      new SesMailTransport(config, null).send(message),
    ).rejects.toThrow(/npm install @aws-sdk\/client-sesv2/);
  });

  it('maps the message onto the structured body ses expects', async () => {
    const { module, send } = fakeSes();
    await new SesMailTransport(config, module).send(message);

    expect(send.mock.calls[0][0]).toMatchObject({
      FromEmailAddress: 'no-reply@example.com',
      Destination: { ToAddresses: ['user@example.com'] },
      Content: {
        Simple: {
          Subject: { Data: 'Welcome' },
          Body: { Text: { Data: 'plain' }, Html: { Data: '<p>html</p>' } },
        },
      },
    });
  });

  it('omits the html part when a template has none', async () => {
    const { module, send } = fakeSes();
    const { html: _html, ...textOnly } = message;
    await new SesMailTransport(config, module).send(textOnly);

    const input = send.mock.calls[0][0] as SesSendEmailInput;
    expect(input.Content?.Simple.Body?.Html).toBeUndefined();
  });

  it('sends both parts when a template has both', async () => {
    const { module, send } = fakeSes();
    await new SesMailTransport(config, module).send(message);

    const input = send.mock.calls[0][0] as SesSendEmailInput;
    expect(input.Content?.Simple.Body?.Text?.Data).toBe('plain');
    expect(input.Content?.Simple.Body?.Html?.Data).toBe('<p>html</p>');
  });

  it('carries cc and bcc into the destination', async () => {
    const { module, send } = fakeSes();
    await new SesMailTransport(config, module).send({
      ...message,
      cc: ['cc@example.com'],
      bcc: ['bcc@example.com'],
    });

    expect(send.mock.calls[0][0].Destination).toEqual({
      ToAddresses: ['user@example.com'],
      CcAddresses: ['cc@example.com'],
      BccAddresses: ['bcc@example.com'],
    });
  });

  it('returns the ses message id', async () => {
    const { module } = fakeSes();

    const result = await new SesMailTransport(config, module).send(message);

    expect(result.providerId).toBe('ses-1');
  });

  it('normalises a recipient list to an array', async () => {
    const { module, send } = fakeSes();
    await new SesMailTransport(config, module).send({
      ...message,
      to: ['a@example.com', 'b@example.com'],
    });

    expect(send.mock.calls[0][0].Destination.ToAddresses).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
  });

  it('works with no region configured, leaving the sdk default in charge', () => {
    const { module, SESv2Client } = fakeSes();
    new SesMailTransport({ ...config, ses: {} }, module);

    expect(SESv2Client).toHaveBeenCalledWith({ region: undefined });
  });
});
