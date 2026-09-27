import { UserResponseDto } from '../../users/dto/index.js';

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserResponseDto;
}
