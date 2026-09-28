import { describe, expect, it } from 'vitest';

import {
  createMailTransport,
  loadTransportPackage,
  type MailTransportName,
} from './mail-transport.factory.js';

const message = { to: 'a@x.com', subject: 's', text: 't' };

describe('loadTransportPackage', () => {
  it('resolves null for the built in memory transport', () => {
    expect(loadTransportPackage('memory')).toBeNull();
  });

  it('resolves null for a provider whose package is not installed', () => {
    for (const name of ['smtp', 'ses', 'sendgrid'] as MailTransportName[]) {
      expect(loadTransportPackage(name)).toBeNull();
    }
  });
});

describe('createMailTransport', () => {
  it('returns the memory transport when it is asked for', () => {
    expect(createMailTransport({ name: 'memory' }).name).toBe('memory');
  });

  it('falls back to memory when the requested package is missing', () => {
    const transport = createMailTransport({ name: 'smtp' });

    expect(transport.name).toBe('memory');
  });

  it('still sends through the fallback instead of throwing', async () => {
    const transport = createMailTransport({ name: 'sendgrid' });

    await expect(transport.send(message)).resolves.toEqual({
      accepted: ['a@x.com'],
      rejected: [],
    });
  });

  it('names the transport so the health check can report it', () => {
    for (const name of [
      'memory',
      'smtp',
      'ses',
      'sendgrid',
    ] as MailTransportName[]) {
      expect(createMailTransport({ name }).name).toBe('memory');
    }
  });
});
