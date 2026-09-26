import { UserResponseDto } from '../../users/dto/index.js';

export interface AuthToken {
  accessToken: string;
  tokenType: 'Bearer';
  user: UserResponseDto;
}
