import { describe, expect, it } from 'vitest';

import { isPermanentRejection } from './transport.interface.js';

describe('isPermanentRejection', () => {
  it('treats a 4xx as permanent, since retrying a bad request cannot help', () => {
    for (const status of [400, 401, 403, 404, 413, 422, 429]) {
      expect(isPermanentRejection({ status })).toBe(true);
    }
  });

  it('treats a 5xx as retryable, since the provider may recover', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isPermanentRejection({ status })).toBe(false);
    }
  });

  it('reads the status from any of the shapes a client uses', () => {
    expect(isPermanentRejection({ status: 400 })).toBe(true);
    expect(isPermanentRejection({ statusCode: 400 })).toBe(true);
    expect(isPermanentRejection({ code: 400 })).toBe(true);
  });

  it('treats a timeout as retryable, having no status at all', () => {
    expect(isPermanentRejection(new Error('socket hang up'))).toBe(false);
    expect(isPermanentRejection({ code: 'ETIMEDOUT' })).toBe(false);
  });

  it('treats a connection error as retryable', () => {
    expect(isPermanentRejection({ code: 'ECONNREFUSED' })).toBe(false);
    expect(isPermanentRejection({ code: 'ECONNRESET' })).toBe(false);
  });

  it('ignores a code that is not an http status', () => {
    // 'ETIMEDOUT' is truthy and a number-looking string is not a status; neither
    // may be mistaken for a 4xx, or every network failure becomes permanent.
    expect(isPermanentRejection({ code: '403' })).toBe(false);
    expect(isPermanentRejection({ code: 99999 })).toBe(false);
  });

  it('handles a thrown primitive without assuming an object', () => {
    expect(isPermanentRejection('boom')).toBe(false);
    expect(isPermanentRejection(null)).toBe(false);
    expect(isPermanentRejection(undefined)).toBe(false);
  });
});
