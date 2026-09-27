export interface TwoFactorChallengePayload {
  sub: string;
  jti: string;
  type: 'two_factor_challenge';
  iat?: number;
  exp?: number;
}
