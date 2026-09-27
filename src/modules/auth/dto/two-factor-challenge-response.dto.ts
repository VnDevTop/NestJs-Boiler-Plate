import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorChallengeResponseDto {
  @ApiProperty({
    example: true,
    description: 'Always true, the credentials were correct but incomplete',
  })
  twoFactorRequired!: true;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short lived token for the two-factor login call',
  })
  challengeToken!: string;

  @ApiProperty({
    example: 300,
    description: 'Challenge lifetime in seconds',
  })
  expiresIn!: number;
}
