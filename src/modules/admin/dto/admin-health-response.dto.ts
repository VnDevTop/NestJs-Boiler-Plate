import { ApiProperty } from '@nestjs/swagger';

export class AdminHealthResponseDto {
  @ApiProperty({
    example: 'ok',
  })
  status!: 'ok';

  @ApiProperty({
    example: 'admin',
  })
  scope!: 'admin';

  @ApiProperty({
    example: '2026-09-26T00:00:00.000Z',
  })
  timestamp!: string;
}
