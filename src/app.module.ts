import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core';
import { ConditionalModule, ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  appConfig,
  cacheConfig,
  corsConfig,
  databaseConfig,
  jwtAccessTokenConfig,
  jwtRefreshTokenConfig,
  observeConfig,
  securityConfig,
  swaggerConfig,
  throttlerConfig,
  twoFactorConfig,
  validateEnvironment,
} from './configs/index.js';
import { AdminModule, AuthModule, UsersModule } from './modules/index.js';
import {
  JwtAuthGuard,
  ManagerGuard,
  PermissionsGuard,
  RolesGuard,
} from './common/guards/index.js';
import { CacheModule, HealthModule } from './core/index.js';
import {
  catchAllRoute,
  RequestIdMiddleware,
} from './common/middlewares/index.js';
import { AppService } from './app.service.js';
import { AppController } from './app.controller.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
      load: [
        appConfig,
        cacheConfig,
        corsConfig,
        databaseConfig,
        jwtAccessTokenConfig,
        jwtRefreshTokenConfig,
        observeConfig,
        securityConfig,
        swaggerConfig,
        throttlerConfig,
        twoFactorConfig,
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
    ThrottlerModule.forRootAsync(throttlerConfig.asProvider()),

    CacheModule,
    HealthModule,
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
    {
      // Registered last so a blocked request is counted before anything else
      // spends time on it, and skipped for probes that carry no identity.
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  configure(consumer: MiddlewareConsumer): void {
    // Every route, so even a request rejected by a guard carries an id that can be
    // quoted in a bug report. The pattern depends on the platform, see
    // catchAllRoute.
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes(catchAllRoute(this.httpAdapterHost.httpAdapter));
  }
}
