import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const https = vi.hoisted(() => ({
  request: vi.fn(),
  Agent: class {},
}));

vi.mock('node:https', () => ({ request: https.request, default: https }));

const { postJson } = await import('./https-post.js');

interface FakeResponse extends EventEmitter {
  statusCode: number;
}

interface FakeRequest extends EventEmitter {
  write: (chunk: Buffer) => void;
  end: () => void;
  destroy: (error?: Error) => void;
}

interface CapturedOptions {
  hostname: string;
  port: string | number;
  path: string;
  method: string;
  headers: Record<string, string>;
  timeout: number;
}

let captured: CapturedOptions | null = null;
let written: Buffer | null = null;

/** Wires `https.request` to a scripted response. */
function scriptResponse(status: number, body: string, hang = false) {
  https.request.mockImplementation(
    (options: CapturedOptions, callback: unknown) => {
      captured = options;
      written = null;

      const req = new EventEmitter() as FakeRequest;
      req.write = (chunk: Buffer) => {
        written = chunk;
      };
      req.destroy = (error?: Error) => {
        req.emit('error', error ?? new Error('destroyed'));
      };
      req.end = () => {
        if (hang) {
          // The real socket emits `timeout`; the fake has to as well.
          setTimeout(() => req.emit('timeout'), 10);
          return;
        }

        const res = new EventEmitter() as FakeResponse;
        res.statusCode = status;
        (callback as (r: FakeResponse) => void)(res);
        res.emit('data', Buffer.from(body));
        res.emit('end');
      };

      return req;
    },
  );
}

describe('postJson', () => {
  beforeEach(() => {
    captured = null;
    written = null;
    https.request.mockReset();
    scriptResponse(200, JSON.stringify({ ok: true }));
  });

  it('refuses a plain http url so a token is never sent in clear text', async () => {
    await expect(
      postJson({ url: 'http://api.telegram.org/x', body: {} }),
    ).rejects.toThrow(/expected https/);
    expect(https.request).not.toHaveBeenCalled();
  });

  it('refuses a malformed url', async () => {
    await expect(postJson({ url: 'not-a-url', body: {} })).rejects.toThrow();
  });

  it('posts json to an https endpoint', async () => {
    const result = await postJson({
      url: 'https://api.telegram.org/bot1/sendMessage?a=1',
      body: { chat_id: 1 },
      headers: { 'x-test': 'yes' },
    });

    expect(result).toEqual({ status: 200, body: '{"ok":true}' });
    expect(captured).toMatchObject({
      hostname: 'api.telegram.org',
      port: 443,
      path: '/bot1/sendMessage?a=1',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test': 'yes' },
    });
    expect(captured?.headers['content-length']).toBe('13');
    expect(written?.toString()).toBe('{"chat_id":1}');
  });

  it('honours an explicit port', async () => {
    await postJson({ url: 'https://127.0.0.1:8443/hook', body: {} });

    expect(captured?.port).toBe('8443');
  });

  it('resolves with the status of a rejected request', async () => {
    scriptResponse(500, 'boom');

    expect(await postJson({ url: 'https://x.test/h', body: {} })).toEqual({
      status: 500,
      body: 'boom',
    });
  });

  it('joins a response that arrives in several chunks', async () => {
    https.request.mockImplementation(
      (options: CapturedOptions, callback: unknown) => {
        captured = options;
        const req = new EventEmitter() as FakeRequest;
        req.write = () => {};
        req.destroy = () => req.emit('error', new Error('destroyed'));
        req.end = () => {
          const res = new EventEmitter() as FakeResponse;
          res.statusCode = 200;
          (callback as (r: FakeResponse) => void)(res);
          res.emit('data', Buffer.from('ab'));
          res.emit('data', Buffer.from('cd'));
          res.emit('end');
        };
        return req;
      },
    );

    expect((await postJson({ url: 'https://x.test/h', body: {} })).body).toBe(
      'abcd',
    );
  });

  it('rejects on a socket error so the caller can retry', async () => {
    https.request.mockImplementation(() => {
      const req = new EventEmitter() as FakeRequest;
      req.write = () => {};
      req.destroy = () => req.emit('error', new Error('destroyed'));
      req.end = () =>
        process.nextTick(() => req.emit('error', new Error('ECONNRESET')));
      return req;
    });

    await expect(
      postJson({ url: 'https://x.test/h', body: {} }),
    ).rejects.toThrow('ECONNRESET');
  });

  it('rejects when the endpoint does not answer in time', async () => {
    scriptResponse(200, '', true);

    await expect(
      postJson({ url: 'https://x.test/h', body: {}, timeoutMs: 50 }),
    ).rejects.toThrow();
  });

  it('defaults the timeout when none is given', async () => {
    await postJson({ url: 'https://x.test/h', body: {} });

    expect(captured?.timeout).toBe(5_000);
  });
});
