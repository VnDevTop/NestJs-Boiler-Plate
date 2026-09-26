import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  appConfig,
  databaseConfig,
  jwtAccessTokenConfig,
  jwtRefreshTokenConfig,
  observeConfig,
  swaggerConfig,
} from './configs/index.js';
import { AdminModule, AuthModule, UsersModule } from './modules/index.js';
import {
  JwtAuthGuard,
  ManagerGuard,
  PermissionsGuard,
  RolesGuard,
} from './common/guards/index.js';
import { AppService } from './app.service.js';
import { AppController } from './app.controller.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        jwtAccessTokenConfig,
        jwtRefreshTokenConfig,
        databaseConfig,
        observeConfig,
        swaggerConfig,
      ],
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ConditionalModule.registerWhen(
      ObserveModule.forRootAsync(observeConfig.asProvider()),
      (env: NodeJS.ProcessEnv) =>
        !!env['OBSERVE_APP_KEY'] &&
        !!env['OBSERVE_APP_SECRET'] &&
        !!env['OBSERVE_SERVICE_ID'],
    ),
    TypeOrmModule.forRootAsync(databaseConfig.asProvider()),

    UsersModule,
    AuthModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ManagerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
