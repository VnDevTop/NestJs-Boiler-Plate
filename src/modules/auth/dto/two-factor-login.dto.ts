import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

import { TwoFactorCodeDto } from './two-factor-code.dto.js';

export class TwoFactorLoginDto extends TwoFactorCodeDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Challenge token returned by the login call when two-factor is enabled',
  })
  @IsString()
  @MinLength(1)
  challengeToken!: string;
}
