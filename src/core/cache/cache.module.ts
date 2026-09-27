import { Global, Logger, Module } from '@nestjs/common';
// Aliased because this file also declares a CacheModule of its own.
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { Keyv } from 'keyv';
import { createClient, type RedisClientType } from 'redis';

import { cacheConfig, type CacheConfig } from '../../configs/index.js';
import { CacheService } from './cache.service.js';

const logger = new Logger('CacheModule');

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      ...cacheConfig.asProvider(),
      useFactory: async (config: CacheConfig) => {
        const ttl = config.defaultTtl * 1000;

        if (config.backend === 'memory') {
          return { stores: [new Keyv()], ttl };
        }

        // The client is built here rather than left to createKeyv, which only
        // accepts a URL and hardcodes the socket options, so client level
        // settings could not be passed through.
        const client = createClient({
          url: config.url,
          socket: { connectTimeout: config.connectTimeout },
          // node-redis keeps commands in an offline queue while the socket is
          // reconnecting, so a command issued in that window would wait for the
          // outage to end instead of reporting a miss straight away.
          disableOfflineQueue: true,
        });

        // A dead cache must not become an unhandled error event, and the store
        // turns these into misses, so they are logged rather than thrown.
        client.on('error', (error: Error) =>
          logger.warn(`Cache unavailable: ${error.message}`),
        );

        // The cast is only for the store's Redis client generic, which does not
        // carry the json module the client type defaults to. Nothing about the
        // commands used here is affected.
        const store = createKeyv(client as unknown as RedisClientType, {
          namespace: config.keyPrefix,
          keyPrefixSeparator: ':',
          connectionTimeout: config.connectTimeout,
          throwOnErrors: true,
        });

        // A Keyv store connects lazily, so this read is what turns an
        // unreachable cache into a failed boot. Without it the app would start
        // and then fail on the first request, which is harder to diagnose. Only
        // the probe wants errors thrown; switching them off afterwards makes a
        // later outage a miss rather than a 500.
        await store.get('__startup__');
        store.throwOnErrors = false;

        return { stores: [store], ttl };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
