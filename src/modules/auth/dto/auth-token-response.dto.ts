import { ApiProperty } from '@nestjs/swagger';

import { UserResponseDto } from '../../users/dto/index.js';

export class AuthTokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'Bearer',
  })
  tokenType!: 'Bearer';

  @ApiProperty({
    type: () => UserResponseDto,
  })
  user!: UserResponseDto;
}
