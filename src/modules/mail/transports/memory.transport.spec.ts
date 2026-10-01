import { describe, expect, it } from 'vitest';

import { MemoryMailTransport } from './memory.transport.js';
import type { MailMessage } from './transport.interface.js';

const message: MailMessage = {
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'Hello',
  mailId: 'mail-1',
  template: 'welcome',
};

describe('MemoryMailTransport', () => {
  it('names itself, so the health check can report the active transport', () => {
    expect(new MemoryMailTransport().name).toBe('memory');
  });

  it('accepts a single recipient', async () => {
    const result = await new MemoryMailTransport().send(message);

    expect(result).toEqual({ accepted: ['user@example.com'], rejected: [] });
  });

  it('accepts a recipient list', async () => {
    const result = await new MemoryMailTransport().send({
      ...message,
      to: ['a@example.com', 'b@example.com'],
    });

    expect(result.accepted).toEqual(['a@example.com', 'b@example.com']);
  });

  it('keeps the message for inspection', async () => {
    const transport = new MemoryMailTransport();
    await transport.send(message);

    expect(transport.getSent()).toEqual([message]);
  });

  it('keeps the mail id, which is what ties a log line to a delivery', async () => {
    const transport = new MemoryMailTransport();
    await transport.send(message);

    expect(transport.getSent()[0].mailId).toBe('mail-1');
  });

  it('does not hand out its live array', async () => {
    const transport = new MemoryMailTransport();
    await transport.send(message);

    (transport.getSent() as MailMessage[]).push(message);

    expect(transport.getSent()).toHaveLength(1);
  });

  it('finds the most recent message for a recipient', async () => {
    const transport = new MemoryMailTransport();
    await transport.send({ ...message, subject: 'first' });
    await transport.send({ ...message, subject: 'second' });

    expect(transport.lastTo('user@example.com')?.subject).toBe('second');
  });

  it('returns nothing for a recipient it never sent to', () => {
    expect(
      new MemoryMailTransport().lastTo('nobody@example.com'),
    ).toBeUndefined();
  });

  it('finds a recipient inside a list', async () => {
    const transport = new MemoryMailTransport();
    await transport.send({
      ...message,
      to: ['a@example.com', 'b@example.com'],
    });

    expect(transport.lastTo('a@example.com')).toBeDefined();
  });

  it('clears what it kept', async () => {
    const transport = new MemoryMailTransport();
    await transport.send(message);
    transport.clear();

    expect(transport.getSent()).toEqual([]);
  });

  it('does not clear on a read', async () => {
    const transport = new MemoryMailTransport();
    await transport.send(message);
    transport.lastTo('user@example.com');

    expect(transport.getSent()).toHaveLength(1);
  });
});
