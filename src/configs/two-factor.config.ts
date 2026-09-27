import { registerAs } from '@nestjs/config';

export interface TwoFactorOptions {
  enabled: boolean;
  encryptionKey: string;
  issuer: string;
}

export const twoFactorConfig = registerAs(
  'twoFactor',
  (): TwoFactorOptions => ({
    enabled: process.env.TWO_FACTOR_ENABLED !== 'false',
    encryptionKey:
      process.env.TWO_FACTOR_ENCRYPTION_KEY ?? 'change-me-in-production',
    issuer: process.env.TWO_FACTOR_ISSUER ?? 'NestJS Boilerplate',
  }),
);
