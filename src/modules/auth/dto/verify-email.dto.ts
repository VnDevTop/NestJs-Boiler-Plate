import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'aGVsbG8td29ybGQtdG9rZW4',
    description: 'The token from the verification link. Single use.',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
