import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  name: process.env.APP_NAME ?? 'nestjs-boiler-plate',
  port: Number(process.env.PORT ?? 3000),
  globalPrefix: process.env.API_PREFIX ?? 'api',
  version: process.env.API_VERSION ?? '1',
}));
