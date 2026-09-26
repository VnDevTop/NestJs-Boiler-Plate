import { registerAs } from '@nestjs/config';
import { JwtModuleOptions } from "@nestjs/jwt";

export const jwtAccessTokenConfig = registerAs('jwtAccessToken', (): JwtModuleOptions => ({
  secret: process.env.JWT_SECRET ?? 'change-me',
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  },
}));

export const jwtRefreshTokenConfig = registerAs('jwtRefreshToken', (): JwtModuleOptions => ({
  secret: process.env.JWT_REFRESH_SECRET ?? 'change-me',
  signOptions: {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },
}));
