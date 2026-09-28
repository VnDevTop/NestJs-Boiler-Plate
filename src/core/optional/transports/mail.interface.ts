export interface MailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface MailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: MailAttachment[];
  /** Correlation id, so a delivery can be traced through the logs. */
  mailId?: string;
}

export interface SendResult {
  accepted: string[];
  rejected: string[];
  /** Provider message id, absent for the memory transport. */
  providerId?: string;
}

export interface MailTransport {
  readonly name: string;
  send(message: MailMessage): Promise<SendResult>;
}
