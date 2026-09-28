export interface WebhookPayload {
  /** Message text, already formatted for the channel. */
  text: string;
  /** Short headline, used by channels that support a title block. */
  title?: string;
  /** Event key, used for grouping and for de-duplication. */
  event?: string;
}

export interface WebhookResult {
  delivered: boolean;
  status: number;
}

export interface WebhookChannel {
  readonly name: string;
  send(payload: WebhookPayload): Promise<WebhookResult>;
}
