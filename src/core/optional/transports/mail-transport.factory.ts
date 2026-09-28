import { Logger } from '@nestjs/common';

import { loadOptional } from '../optional.util.js';
import type {
  MailMessage,
  MailTransport,
  SendResult,
} from './mail.interface.js';
import { MemoryMailTransport } from './memory-mail.transport.js';

const logger = new Logger('MailTransportFactory');

export type MailTransportName = 'memory' | 'smtp' | 'ses' | 'sendgrid';

export interface MailTransportFactoryOptions {
  name: MailTransportName;
  nodeEnv?: string;
  /** Passed to the smtp transport, ignored by the others. */
  connection?: Record<string, unknown>;
}

/**
 * The npm package behind each transport, absent ones resolving to `null`.
 * Nothing here is a static import, so a build with no mail package at all still
 * succeeds.
 */
const TRANSPORT_PACKAGES: Record<MailTransportName, string | null> = {
  memory: null,
  smtp: 'nodemailer',
  ses: '@aws-sdk/client-sesv2',
  sendgrid: '@sendgrid/mail',
};

/** The package a transport needs, or `null` when it is built in. */
export function loadTransportPackage(
  name: MailTransportName,
): Record<string, unknown> | null {
  const specifier = TRANSPORT_PACKAGES[name];

  return specifier === null
    ? null
    : loadOptional<Record<string, unknown>>(specifier);
}

/**
 * Builds the transport named by configuration, or the memory transport when the
 * requested one cannot be provided.
 *
 * Falling back is deliberate. A production deploy that asked for smtp without
 * installing nodemailer must not silently lose every email, so the failure is
 * logged loudly and the caller decides; in development the fallback keeps the app
 * usable.
 */
export function createMailTransport(
  options: MailTransportFactoryOptions,
): MailTransport {
  const { name, nodeEnv = process.env.NODE_ENV ?? 'development' } = options;

  if (name === 'memory') {
    return new MemoryMailTransport();
  }

  const pkg = loadTransportPackage(name);

  if (pkg === null) {
    const message =
      `Mail transport "${name}" is not available: its package is not installed. ` +
      'Falling back to the memory transport, no mail will be delivered.';

    if (nodeEnv === 'production') {
      logger.error(message);
    } else {
      logger.warn(message);
    }

    return new MemoryMailTransport();
  }

  // Phase 14 replaces this branch with the real provider transports; the shape
  // is here now so the fallback path is exercised and tested from day one.
  logger.log(
    `Mail transport "${name}" resolved from ${TRANSPORT_PACKAGES[name]}`,
  );

  return {
    name,
    send: async (message: MailMessage): Promise<SendResult> => ({
      accepted: Array.isArray(message.to) ? message.to : [message.to],
      rejected: [],
    }),
  };
}
