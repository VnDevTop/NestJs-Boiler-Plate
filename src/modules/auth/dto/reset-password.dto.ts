import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * The bounds here are the widest this boilerplate allows, not a policy
 * recommendation. `password-policy.config.ts` carries the policy a deployment
 * sets, and Phase 19 replaces this decorator pair with a schema built from it,
 * so the rule lives in one place instead of two.
 */
export class ResetPasswordDto {
  @ApiProperty({
    example: 'aGVsbG8td29ybGQtdG9rZW4',
    description: 'The token from the reset link. Single use.',
  })
  @IsString()
  token!: string;

  @ApiProperty({
    example: 'a-new-strong-password',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
