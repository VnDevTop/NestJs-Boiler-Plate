import { ApiProperty } from '@nestjs/swagger';

export class GenericMessageDto {
  @ApiProperty({
    example:
      'If an account exists for that address, a reset link is on its way.',
    description:
      'The same message for every outcome, so the route cannot be used to find ' +
      'out whether an address is registered.',
  })
  message!: string;
}
