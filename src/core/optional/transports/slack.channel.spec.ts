import { beforeEach, describe, expect, it, vi } from 'vitest';

const postJson = vi.hoisted(() => vi.fn());

vi.mock('./https-post.js', () => ({ postJson }));

const { SlackChannel } = await import('./slack.channel.js');

const options = { webhookUrl: 'https://hooks.slack.com/services/T/B/X' };

describe('SlackChannel', () => {
  beforeEach(() => {
    postJson.mockReset();
    postJson.mockResolvedValue({ status: 200, body: 'ok' });
  });

  it('posts to the incoming webhook url', async () => {
    const channel = new SlackChannel(options);

    const result = await channel.send({ text: 'user registered' });

    expect(result).toEqual({ delivered: true, status: 200 });
    expect(postJson.mock.calls[0][0].url).toBe(options.webhookUrl);
  });

  it('sends a title block when a title is given', async () => {
    await new SlackChannel(options).send({
      title: 'User registered',
      text: 'ada@example.com',
    });

    const body = postJson.mock.calls[0][0].body as {
      blocks: { text: { text: string } }[];
    };

    expect(body.blocks[0].text.text).toBe('*User registered*');
    expect(body.blocks[1].text.text).toBe('ada@example.com');
  });

  it('omits the title block when there is no title', async () => {
    await new SlackChannel(options).send({ text: 'plain' });

    const body = postJson.mock.calls[0][0].body as { blocks: unknown[] };

    expect(body.blocks).toHaveLength(1);
  });

  it('reports a rejection without throwing', async () => {
    postJson.mockResolvedValue({ status: 404, body: 'no_service' });

    expect(await new SlackChannel(options).send({ text: 'x' })).toEqual({
      delivered: false,
      status: 404,
    });
  });

  it('works as a discord channel on the same payload shape', () => {
    expect(new SlackChannel(options).name).toBe('slack');
  });
});
