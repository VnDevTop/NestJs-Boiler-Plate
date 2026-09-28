import { registerAs } from '@nestjs/config';
import { CorsOptions } from '@nestjs/common/internal';

/** Origins are untrusted input, so they are parsed once, here. */
function toOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const corsConfig = registerAs('cors', (): CorsOptions => {
  const origins = toOrigins(process.env.CORS_ORIGINS);

  return {
    // Left undefined when no allow-list is configured, which is the safe default
    // for an API that is not called from a browser: main.ts then enables nothing.
    origin: origins.length ? origins : undefined,
    // Needed for cookies, not for an Authorization header. Off by default so a
    // wildcard origin cannot be combined with credentials, which browsers reject
    // anyway and which would make the allow-list meaningless.
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Device-Name',
    ],
    // Without this a browser cannot read the request id from the response, which
    // is the one header a client needs when reporting a problem.
    exposedHeaders: ['X-Request-Id'],
    maxAge: Number(process.env.CORS_MAX_AGE ?? 86400),
  };
});
