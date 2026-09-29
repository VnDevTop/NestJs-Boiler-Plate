import { describe, expect, it, vi } from 'vitest';

import type { MailConfig } from '../../../configs/mail.config.js';
import type { SendgridMail } from './provider.types.js';
import { SendgridMailTransport } from './sendgrid.transport.js';
import type { MailMessage } from './transport.interface.js';

const config: MailConfig = {
  transport: 'sendgrid',
  fromName: 'Example',
  from: 'no-reply@example.com',
  subjectPrefix: '',
  smtp: {
    host: 'localhost',
    port: 587,
    secure: false,
  },
  sendgrid: { apiKey: 'SG.test' },
  ses: {},
  timeouts: { connection: 5000, socket: 10000 },
};

const message: MailMessage = {
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'plain',
  html: '<p>html</p>',
  mailId: 'mail-1',
};

function fakeSendgrid() {
  const setApiKey = vi.fn();
  const send = vi.fn().mockResolvedValue([{ statusCode: 202 }]);

  return {
    client: { setApiKey, send } as unknown as SendgridMail,
    setApiKey,
    send,
  };
}

describe('SendgridMailTransport', () => {
  it('reports itself unavailable when the package is missing', () => {
    expect(new SendgridMailTransport(config, null).isAvailable()).toBe(false);
  });

  it('sets the api key once at construction, not per message', async () => {
    const { client, setApiKey, send } = fakeSendgrid();
    const transport = new SendgridMailTransport(config, client);
    await transport.send(message);
    await transport.send(message);

    expect(setApiKey).toHaveBeenCalledTimes(1);
    expect(setApiKey).toHaveBeenCalledWith('SG.test');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not call setApiKey when no key is configured', () => {
    // A dev using the memory transport has no key; calling setApiKey with
    // undefined would be a call the sdk rejects.
    const { client, setApiKey } = fakeSendgrid();
    new SendgridMailTransport({ ...config, sendgrid: {} }, client);

    expect(setApiKey).not.toHaveBeenCalled();
  });

  it('throws with the install command when used without the package', async () => {
    await expect(
      new SendgridMailTransport(config, null).send(message),
    ).rejects.toThrow(/npm install @sendgrid\/mail/);
  });

  it('sends the from name and address as the pair sendgrid expects', async () => {
    const { client, send } = fakeSendgrid();
    await new SendgridMailTransport(config, client).send(message);

    expect(send.mock.calls[0][0].from).toEqual({
      email: 'no-reply@example.com',
      name: 'Example',
    });
  });

  it('passes both body parts', async () => {
    const { client, send } = fakeSendgrid();
    await new SendgridMailTransport(config, client).send(message);

    expect(send.mock.calls[0][0]).toMatchObject({
      text: 'plain',
      html: '<p>html</p>',
    });
  });

  it('accepts a queued send, which sendgrid answers with 202', async () => {
    const { client } = fakeSendgrid();

    const result = await new SendgridMailTransport(config, client).send(
      message,
    );

    expect(result).toEqual({
      accepted: ['user@example.com'],
      rejected: [],
    });
  });

  it('refuses to send with no from address at all', async () => {
    const { client } = fakeSendgrid();
    const { from: _from, ...withoutFrom } = config;

    await expect(
      new SendgridMailTransport(withoutFrom, client).send(message),
    ).rejects.toThrow(/MAIL_FROM/);
  });

  it('names itself for the health check', () => {
    expect(new SendgridMailTransport(config, null).name).toBe('sendgrid');
  });
});
