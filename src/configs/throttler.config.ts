import { registerAs } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig = registerAs(
  'throttler',
  (): ThrottlerModuleOptions => ({
    // Lets a client see how much budget it has left and back off, instead of
    // only discovering the limit by being rejected.
    setHeaders: true,
    throttlers: [
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
        blockDuration:
          Number(process.env.THROTTLE_BLOCK_DURATION ?? 0) || undefined,
      },
    ],
  }),
);
