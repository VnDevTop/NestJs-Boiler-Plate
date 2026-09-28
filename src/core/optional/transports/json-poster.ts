import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface JsonPostOptions {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface JsonPostResult {
  status: number;
  body: string;
}

/**
 * Single JSON POST, on top of `HttpService`.
 *
 * Telegram and Slack both take one JSON payload at an https endpoint, so a
 * webhook channel is a few lines of payload building. The transport itself is
 * `HttpService` from `@nestjs/axios`, which is already a Nest dependency of this
 * boilerplate, so neither channel needs a package of its own.
 *
 * `validateStatus` accepts every status, so a 4xx from a provider is returned to
 * the caller as a result instead of thrown: a rejected Telegram message is a
 * fact to log, not an exception to unwind a request with. Network failures still
 * reject, because those are retryable.
 *
 * Only https is allowed, so a misconfigured `http://` webhook fails loudly
 * instead of sending a bot token in clear text.
 */
export async function postJson(
  http: HttpService,
  options: JsonPostOptions,
): Promise<JsonPostResult> {
  let url: URL;

  try {
    url = new URL(options.url);
  } catch {
    throw new Error(`Invalid url: ${options.url}`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`Refusing to post to ${url.protocol}//, expected https:`);
  }

  const response = await firstValueFrom(
    http.post(options.url, options.body, {
      headers: options.headers,
      timeout: options.timeoutMs ?? 5_000,
      responseType: 'text',
      transformResponse: [(data: unknown) => data],
      validateStatus: () => true,
    }),
  );

  return {
    status: response.status,
    body: typeof response.data === 'string' ? response.data : '',
  };
}
