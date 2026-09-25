import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ConsoleLogger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    logger: new ConsoleLogger({
      logLevels: ['error', 'warn', 'log', 'debug', 'verbose'],
      timestamp: process.env.NODE_ENV == 'development',
      json: process.env.NODE_ENV == 'production',
    }),
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
