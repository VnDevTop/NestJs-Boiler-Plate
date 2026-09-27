export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  email?: string;
  iat?: number;
  exp?: number;
}
