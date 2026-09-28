import { describe, expect, it } from 'vitest';

import { MemoryMailTransport } from './memory-mail.transport.js';
import type { MailMessage } from './mail.interface.js';

const message: MailMessage = {
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'Hello',
  mailId: 'mail-1',
};

describe('MemoryMailTransport', () => {
  it('accepts a single recipient', async () => {
    const transport = new MemoryMailTransport();

    const result = await transport.send(message);

    expect(result).toEqual({ accepted: ['user@example.com'], rejected: [] });
  });

  it('accepts a recipient list', async () => {
    const transport = new MemoryMailTransport();

    const result = await transport.send({
      ...message,
      to: ['a@x.com', 'b@x.com'],
    });

    expect(result.accepted).toEqual(['a@x.com', 'b@x.com']);
  });

  it('keeps the message for inspection', async () => {
    const transport = new MemoryMailTransport();
    await transport.send(message);

    expect(transport.getSent()).toEqual([message]);
  });

  it('does not expose its internal array', async () => {
    const transport = new MemoryMailTransport();
    await transport.send(message);

    (transport.getSent() as MailMessage[]).push(message);

    expect(transport.getSent()).toHaveLength(1);
  });

  it('clears what it kept', async () => {
    const transport = new MemoryMailTransport();
    await transport.send(message);
    transport.clear();

    expect(transport.getSent()).toEqual([]);
  });

  it('names itself so the health check can report the active transport', () => {
    expect(new MemoryMailTransport().name).toBe('memory');
  });
});
