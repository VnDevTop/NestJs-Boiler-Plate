import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardResponseDto {
  @ApiProperty({
    example: 'Admin dashboard',
  })
  message!: string;

  @ApiProperty({
    example: 'admin',
  })
  scope!: 'admin';

  @ApiProperty({
    example: '2026-09-26T00:00:00.000Z',
  })
  timestamp!: string;
}
