import { HttpService } from '@nestjs/axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { SlackChannel } from './slack.channel.js';

const options = { webhookUrl: 'https://hooks.slack.com/services/T/B/X' };

let http: HttpService;

function stub(status = 200): void {
  http = {
    post: vi.fn().mockReturnValue(of({ status, data: 'ok' })),
  } as unknown as HttpService;
}

function lastBody() {
  return vi.mocked(http.post).mock.calls[0][1] as {
    blocks: { text: { text: string } }[];
  };
}

describe('SlackChannel', () => {
  beforeEach(() => stub());

  it('posts to the incoming webhook url', async () => {
    const channel = new SlackChannel(http, options);

    const result = await channel.send({ text: 'user registered' });

    expect(result).toEqual({ delivered: true, status: 200 });
    expect(http.post).toHaveBeenCalledWith(
      options.webhookUrl,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('sends a title block when a title is given', async () => {
    await new SlackChannel(http, options).send({
      title: 'User registered',
      text: 'ada@example.com',
    });

    expect(lastBody().blocks[0].text.text).toBe('*User registered*');
    expect(lastBody().blocks[1].text.text).toBe('ada@example.com');
  });

  it('omits the title block when there is no title', async () => {
    await new SlackChannel(http, options).send({ text: 'plain' });

    expect(lastBody().blocks).toHaveLength(1);
  });

  it('reports a rejection without throwing', async () => {
    stub(404);

    expect(await new SlackChannel(http, options).send({ text: 'x' })).toEqual({
      delivered: false,
      status: 404,
    });
  });

  it('propagates a network failure so the caller can retry', async () => {
    http = {
      post: vi.fn().mockReturnValue(throwError(() => new Error('ECONNRESET'))),
    } as unknown as HttpService;

    await expect(
      new SlackChannel(http, options).send({ text: 'x' }),
    ).rejects.toThrow('ECONNRESET');
  });

  it('works as a discord channel on the same payload shape', () => {
    expect(new SlackChannel(http, options).name).toBe('slack');
  });
});
