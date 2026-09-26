import { registerAs } from '@nestjs/config';

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED !== 'false',
  title: process.env.SWAGGER_TITLE ?? 'NestJS Boilerplate API',
  description:
    process.env.SWAGGER_DESCRIPTION ??
    'Production-ready NestJS boilerplate API documentation',
  version: process.env.SWAGGER_VERSION ?? '1.0.0',
  path: process.env.SWAGGER_PATH ?? 'docs',
}));
