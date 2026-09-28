import type { LogLevel } from '@nestjs/common';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { runWithRequestId } from '../../common/utils/index.js';
import { AppLogger } from './app.logger.js';

const ALL_LEVELS: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];

/** Collects what the logger writes, one array entry per line. */
function setup(levels: LogLevel[] = ALL_LEVELS) {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));

      callback();
    },
  });

  return { lines, log: new AppLogger({ levels, stream }) };
}

const parse = (line: string) => JSON.parse(line) as Record<string, unknown>;

describe('AppLogger', () => {
  it('writes one JSON object per line', () => {
    const { lines, log } = setup();

    log.log('started');
    log.warn('careful', 'MyContext');

    expect(lines).toHaveLength(2);
    expect(parse(lines[0])).toMatchObject({ level: 'log', message: 'started' });
    expect(parse(lines[1])).toMatchObject({
      level: 'warn',
      context: 'MyContext',
    });
  });

  it('keeps a multiline message on a single line', () => {
    // A stack trace is the usual source, and a log shipper reads one object per
    // line, so an unescaped newline would split it into broken records.
    const { lines, log } = setup();

    log.error(new Error('boom'));

    expect(lines).toHaveLength(1);
    expect(parse(lines[0]).message).toMatchObject({ name: 'Error' });
  });

  it('serialises an error with its name, message and stack', () => {
    const { lines, log } = setup();

    log.error(new Error('boom'));

    const message = parse(lines[0]).message as Record<string, string>;

    expect(message.name).toBe('Error');
    expect(message.message).toBe('boom');
    expect(message.stack).toContain('Error: boom');
  });

  it('includes the request id while handling a request', () => {
    const { lines, log } = setup();

    runWithRequestId('trace-abc-123456', () => log.log('handling'));

    expect(parse(lines[0]).requestId).toBe('trace-abc-123456');
  });

  it('omits the request id outside a request', () => {
    const { lines, log } = setup();

    log.log('boot');

    expect(parse(lines[0])).not.toHaveProperty('requestId');
  });

  it('does not leak a request id into the next line', () => {
    // The id comes from an async context, so this is the failure mode that would
    // silently mislabel every log line after a request.
    const { lines, log } = setup();

    runWithRequestId('trace-abc-123456', () => log.log('inside'));
    log.log('outside');

    expect(parse(lines[0]).requestId).toBe('trace-abc-123456');
    expect(parse(lines[1])).not.toHaveProperty('requestId');
  });

  it('skips a level it was not given', () => {
    const { lines, log } = setup(['error']);

    log.debug('not wanted');
    log.error('wanted');

    expect(lines).toHaveLength(1);
    expect(parse(lines[0]).message).toBe('wanted');
  });

  it('stamps a timestamp in ISO form', () => {
    const { lines, log } = setup();

    log.log('x');

    expect(parse(lines[0]).timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });
});
