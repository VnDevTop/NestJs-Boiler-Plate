export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCode: string;
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
  expiresIn: number;
}
