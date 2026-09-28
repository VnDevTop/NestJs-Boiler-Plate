import { HttpService } from '@nestjs/axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { escapeMarkdownV2, TelegramChannel } from './telegram.channel.js';

const options = { botToken: 'token', chatId: '-100', topicId: '42' };

let http: HttpService;

function stub(status = 200): void {
  http = {
    post: vi.fn().mockReturnValue(of({ status, data: 'ok' })),
  } as unknown as HttpService;
}

function lastBody() {
  return vi.mocked(http.post).mock.calls[0][1] as Record<string, unknown>;
}

describe('escapeMarkdownV2', () => {
  it('escapes every character Telegram treats as markup', () => {
    expect(escapeMarkdownV2('a_b*c`d[e]f')).toBe('a\\_b\\*c\\`d\\[e\\]f');
  });

  it('escapes a dot and an exclamation mark, which are markup at line end', () => {
    expect(escapeMarkdownV2('done.')).toBe('done\\.');
  });

  it('escapes a backslash before anything else', () => {
    expect(escapeMarkdownV2('a\\b')).toBe('a\\\\b');
  });

  it('leaves plain text untouched', () => {
    expect(escapeMarkdownV2('user registered')).toBe('user registered');
  });
});

describe('TelegramChannel', () => {
  beforeEach(() => stub());

  it('posts an escaped message to the bot api', async () => {
    const channel = new TelegramChannel(http, options);

    const result = await channel.send({ text: 'user_a registered' });

    expect(result).toEqual({ delivered: true, status: 200 });
    expect(http.post).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({
        text: 'user\\_a registered',
        parse_mode: 'MarkdownV2',
        chat_id: '-100',
      }),
      expect.any(Object),
    );
  });

  it('routes to a topic when one is configured', async () => {
    await new TelegramChannel(http, options).send({ text: 'hi' });

    expect(lastBody().message_thread_id).toBe('42');
  });

  it('omits the topic when none is configured', async () => {
    await new TelegramChannel(http, { botToken: 't', chatId: 'c' }).send({
      text: 'hi',
    });

    expect(lastBody().message_thread_id).toBeUndefined();
  });

  it('reports a rejection without throwing', async () => {
    stub(400);

    const result = await new TelegramChannel(http, options).send({
      text: 'hi',
    });

    expect(result).toEqual({ delivered: false, status: 400 });
  });

  it('propagates a transport failure so the caller can retry', async () => {
    http = {
      post: vi.fn().mockReturnValue(of({ status: 0, data: '' })),
    } as unknown as HttpService;
    vi.mocked(http.post).mockImplementation(() => {
      throw new Error('socket hang up');
    });

    await expect(
      new TelegramChannel(http, options).send({ text: 'hi' }),
    ).rejects.toThrow('socket hang up');
  });
});
