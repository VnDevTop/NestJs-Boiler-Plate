import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  accessTokenSecret: process.env.JWT_SECRET ?? 'change-me',
  accessTokenExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me',
  refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));
