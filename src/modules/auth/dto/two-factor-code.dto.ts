import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { TOTP_DIGITS } from '../../../common/constants/index.js';

export class TwoFactorCodeDto {
  @ApiProperty({
    example: '123456',
    description: `Code from the authenticator app, or a recovery code when the device is lost. TOTP codes are ${TOTP_DIGITS} digits.`,
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
