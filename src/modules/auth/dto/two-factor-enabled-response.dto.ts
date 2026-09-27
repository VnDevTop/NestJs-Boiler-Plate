import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorEnabledResponseDto {
  @ApiProperty({ example: true })
  enabled!: true;

  @ApiProperty({
    example: ['4KP2XQ9F7M', 'J8RVT3WZ6N'],
    description:
      'Single use recovery codes. Shown once, store them somewhere safe',
  })
  recoveryCodes!: string[];
}
