import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({
    example: 'john@example.com',
    description:
      'Address to send the link to. The response is the same whether the ' +
      'address is unknown, unverified or already verified, so the route ' +
      'cannot be used to find out who has an account.',
  })
  @IsEmail()
  email!: string;
}
