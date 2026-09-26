import { ConsoleLogger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import {
  AllExceptionsFilter,
  HttpExceptionFilter,
} from './common/filters/index.js';
import { ResponseTransformInterceptor } from './common/interceptors/index.js';
import { createGlobalValidationPipe } from './common/pipes/index.js';
import { setupSwagger } from './core/index.js';

import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    logger: new ConsoleLogger({
      logLevels: ['error', 'warn', 'log', 'debug', 'verbose'],
      timestamp: process.env.NODE_ENV === 'development',
      json: process.env.NODE_ENV === 'production',
    }),
  });

  const configService = app.get(ConfigService);

  const globalPrefix = configService.get<string>('app.globalPrefix', 'api');
  const version = configService.get<string>('app.version', '1');
  const port = configService.get<number>('app.port', 3000);

  app.setGlobalPrefix(globalPrefix);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: version,
  });

  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  setupSwagger(app);

  await app.listen(port);
}

await bootstrap();
