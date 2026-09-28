import { registerAs } from '@nestjs/config';
import { ObserveOptions } from '@nestjs/observe';

export const observeConfig = registerAs(
  'observe',
  (): ObserveOptions =>
    // ObserveOptions declares all three as required strings, while the env types
    // allow them to be absent. That is consistent with how the module is wired:
    // it is only registered when all three are set, so a missing value here is
    // never read.
    ({
      appKey: process.env.OBSERVE_APP_KEY,
      appSecret: process.env.OBSERVE_APP_SECRET,
      serviceId: process.env.OBSERVE_SERVICE_ID,
    }) as ObserveOptions,
);
