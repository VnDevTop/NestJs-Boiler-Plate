import { registerAs } from '@nestjs/config';

/**
 * Mail settings.
 *
 * Deliberately not exported from `configs/index.ts` and not in the `load` array
 * of `app.module.ts`. This namespace describes optional providers, so it is
 * loaded with `ConfigModule.forFeature(mailConfig)` inside `MailModule`, which
 * is only instantiated when a mail provider is enabled. The main app therefore
 * carries no mail configuration, and the module imports without any of the
 * provider packages installed.
 *
 * The provider option shapes below are declared here rather than imported from
 * `nodemailer`, `@sendgrid/mail` or `@aws-sdk/client-sesv2`. A type-only
 * `typeof import('nodemailer')` would still be resolved by `tsc`, so a clone
 * without the package would fail to typecheck, which is the build-time failure
 * this project is built to avoid. Each shape mirrors the option object its
 * client expects, so a transport passes it straight through.
 */

export type MailTransportName = 'memory' | 'smtp' | 'ses' | 'sendgrid';

export interface MailConfig {
  /**
   * Which transport delivers a message. `memory` is the development default and
   * is refused in production, where a silent no-op mailer is worse than a failed
   * one.
   */
  transport: MailTransportName;
  /** Display name on the From header, for example `NestJS Boilerplate`. */
  fromName: string;
  /** From address, required in production. */
  from?: string;
  /** Optional reply-to, when it differs from the sending address. */
  replyTo?: string;
  /** Prefix on the Subject header, so the app is identifiable in a mailbox. */
  subjectPrefix: string;
  smtp: SmtpOptions;
  sendgrid: SendgridOptions;
  ses: SesOptions;
  /** Timeouts in milliseconds, passed to whichever client is in use. */
  timeouts: MailTimeouts;
}

/** Mirrors the `SMTPTransport.Options` object nodemailer's transport takes. */
export interface SmtpOptions {
  host: string;
  port: number;
  /** Implicit TLS, as required by port 465 providers. */
  secure: boolean;
  username?: string;
  password?: string;
}

/** Mirrors the client options `@sendgrid/mail` is created with. */
export interface SendgridOptions {
  apiKey?: string;
}

/** Mirrors the client options the SES v2 client is created with. */
export interface SesOptions {
  region?: string;
}

export interface MailTimeouts {
  /** How long to wait for the provider to accept the connection. */
  connection: number;
  /** How long to wait for the provider to finish sending. */
  socket: number;
}

function toTransport(value: string | undefined): MailTransportName {
  return value === 'smtp' || value === 'ses' || value === 'sendgrid'
    ? value
    : 'memory';
}

export const mailConfig = registerAs('mail', (): MailConfig => {
  return {
    transport: toTransport(process.env.MAIL_TRANSPORT),
    fromName: process.env.MAIL_FROM_NAME ?? 'NestJS Boilerplate',
    from: process.env.MAIL_FROM,
    replyTo: process.env.MAIL_REPLY_TO,
    subjectPrefix: process.env.MAIL_SUBJECT_PREFIX ?? '',
    smtp: {
      host: process.env.MAIL_SMTP_HOST ?? 'localhost',
      port: Number(process.env.MAIL_SMTP_PORT ?? 587),
      // Port 465 is implicit TLS; 587 is STARTTLS and must not be flagged secure.
      secure: process.env.MAIL_SMTP_SECURE
        ? process.env.MAIL_SMTP_SECURE === 'true'
        : Number(process.env.MAIL_SMTP_PORT ?? 587) === 465,
      username: process.env.MAIL_SMTP_USER,
      password: process.env.MAIL_SMTP_PASSWORD,
    },
    sendgrid: { apiKey: process.env.MAIL_SENDGRID_API_KEY },
    ses: { region: process.env.MAIL_SES_REGION },
    timeouts: {
      connection: Number(process.env.MAIL_CONNECTION_TIMEOUT ?? 10_000),
      socket: Number(process.env.MAIL_SOCKET_TIMEOUT ?? 30_000),
    },
  };
});
