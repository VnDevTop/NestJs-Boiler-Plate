import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';

export interface HttpsPostOptions {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface HttpsPostResult {
  status: number;
  body: string;
}

/**
 * Minimal JSON POST over `node:https`.
 *
 * Telegram and Slack both accept a single JSON payload to an https endpoint, so
 * a webhook channel is a few lines of transport. Pulling in an http client for
 * it would add a dependency to every deployment, including the ones that never
 * send a notification.
 *
 * Only https is allowed, so a misconfigured `http://` webhook is a startup
 * error rather than a token sent in clear text.
 */
export async function postJson(
  options: HttpsPostOptions,
): Promise<HttpsPostResult> {
  let url: URL;

  try {
    url = new URL(options.url);
  } catch {
    // Rejected rather than thrown, so a bad webhook url is one error path for
    // the caller instead of a sync throw inside an async chain.
    throw new Error(`Invalid url: ${options.url}`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`Refusing to post to ${url.protocol}//, expected https:`);
  }

  const payload = Buffer.from(JSON.stringify(options.body));
  const timeoutMs = options.timeoutMs ?? 5_000;

  return new Promise<HttpsPostResult>((resolve, reject) => {
    const req = httpsRequest(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(payload.byteLength),
          ...options.headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        res.on('error', reject);
      },
    );

    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
