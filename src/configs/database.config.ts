import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    autoLoadEntities: true,
    //synchronize: true,
    logging: ['info', 'error'],
    ssl: { rejectUnauthorized: false },
    extra: { ssl: { rejectUnauthorized: false } },
  }),
);
