import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorSetupResponseDto {
  @ApiProperty({
    example: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    description:
      'Base32 shared secret, type it by hand if you cannot scan the QR code',
  })
  secret!: string;

  @ApiProperty({
    example:
      'otpauth://totp/NestJS%20Boilerplate:john@example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=NestJS%20Boilerplate',
    description: 'otpauth URI consumed by authenticator apps',
  })
  otpauthUrl!: string;

  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    description: 'QR code of the otpauth URI, as a data URL',
  })
  qrCode!: string;
}
