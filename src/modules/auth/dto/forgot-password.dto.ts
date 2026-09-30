import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'john@example.com',
    description:
      'Address to send the reset link to. The response is the same whether or ' +
      'not an account exists, so this cannot be used to enumerate users.',
  })
  @IsEmail()
  email!: string;
}
