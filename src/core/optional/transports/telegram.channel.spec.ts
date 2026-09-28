import { beforeEach, describe, expect, it, vi } from 'vitest';

const postJson = vi.hoisted(() => vi.fn());

vi.mock('./https-post.js', () => ({ postJson }));

const { escapeMarkdownV2, TelegramChannel } =
  await import('./telegram.channel.js');

const options = { botToken: 'token', chatId: '-100', topicId: '42' };

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
  beforeEach(() => {
    postJson.mockReset();
    postJson.mockResolvedValue({ status: 200, body: '{"ok":true}' });
  });

  it('posts an escaped message to the bot api', async () => {
    const channel = new TelegramChannel(options);

    const result = await channel.send({ text: 'user_a registered' });

    expect(result).toEqual({ delivered: true, status: 200 });
    const call = postJson.mock.calls[0][0];
    expect(call.url).toBe('https://api.telegram.org/bottoken/sendMessage');
    expect(call.body.text).toBe('user\\_a registered');
    expect(call.body.parse_mode).toBe('MarkdownV2');
  });

  it('routes to a topic when one is configured', async () => {
    await new TelegramChannel(options).send({ text: 'hi' });

    expect(postJson.mock.calls[0][0].body.message_thread_id).toBe('42');
  });

  it('omits the topic when none is configured', async () => {
    await new TelegramChannel({ botToken: 't', chatId: 'c' }).send({
      text: 'hi',
    });

    expect(postJson.mock.calls[0][0].body.message_thread_id).toBeUndefined();
  });

  it('reports a rejection without throwing', async () => {
    postJson.mockResolvedValue({ status: 400, body: 'bad request' });

    const result = await new TelegramChannel(options).send({ text: 'hi' });

    expect(result).toEqual({ delivered: false, status: 400 });
  });

  it('propagates a transport failure so the caller can retry', async () => {
    postJson.mockRejectedValue(new Error('socket hang up'));

    await expect(
      new TelegramChannel(options).send({ text: 'hi' }),
    ).rejects.toThrow('socket hang up');
  });
});
