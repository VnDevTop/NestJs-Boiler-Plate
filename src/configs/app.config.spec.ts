import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appConfig } from './app.config.js';

beforeEach(() => {
  delete process.env.APP_URL;
});

afterEach(() => {
  delete process.env.APP_URL;
});

describe('appConfig', () => {
  it('defaults to localhost, which is right for development', () => {
    expect(appConfig().url).toBe('http://localhost:3000');
  });

  it('reads the configured url', () => {
    process.env.APP_URL = 'https://app.example.com';

    expect(appConfig().url).toBe('https://app.example.com');
  });

  it('strips a trailing slash, so a joined link has no double slash', () => {
    // `${url}/auth/verify` must not come out as `//auth/verify`, which some
    // mail clients read as a path and none of them read as a link.
    process.env.APP_URL = 'https://app.example.com/';

    expect(appConfig().url).toBe('https://app.example.com');
  });

  it('strips every trailing slash, not just one', () => {
    process.env.APP_URL = 'https://app.example.com///';

    expect(appConfig().url).toBe('https://app.example.com');
  });

  it('keeps a path prefix, so an app served under a sub-path still works', () => {
    process.env.APP_URL = 'https://example.com/api';

    expect(appConfig().url).toBe('https://example.com/api');
  });
});
