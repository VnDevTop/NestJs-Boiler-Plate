import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshToken, UserDevice } from './entities/index.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { DeviceService } from './device.service.js';
import { JwtStrategy } from './strategies/index.js';
import { jwtAccessTokenConfig } from '../../configs/index.js';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken, UserDevice]),
    JwtModule.registerAsync(jwtAccessTokenConfig.asProvider()),
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenService, DeviceService, JwtStrategy],
  exports: [AuthService, RefreshTokenService, DeviceService],
})
export class AuthModule {}
