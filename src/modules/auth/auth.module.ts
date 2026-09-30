import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
  TwoFactorSecret,
  UserDevice,
} from './entities/index.js';
import { PasswordResetService } from './password-reset.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { DeviceService } from './device.service.js';
import { TwoFactorService } from './two-factor.service.js';
import { JwtStrategy } from './strategies/index.js';
import { jwtAccessTokenConfig } from '../../configs/index.js';
import { MailModule } from '../mail/index.js';

@Module({
  imports: [
    PassportModule,
    // Mail is an export of MailModule, so the template names and the transport
    // live in the mail module rather than in auth.
    MailModule,
    TypeOrmModule.forFeature([
      RefreshToken,
      UserDevice,
      TwoFactorSecret,
      PasswordResetToken,
      EmailVerificationToken,
    ]),
    JwtModule.registerAsync(jwtAccessTokenConfig.asProvider()),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    PasswordResetService,
    DeviceService,
    TwoFactorService,
    JwtStrategy,
  ],
  exports: [AuthService, RefreshTokenService, DeviceService, TwoFactorService],
})
export class AuthModule {}
