export enum RefreshTokenRevokedReason {
  Rotated = 'rotated',
  Logout = 'logout',
  LogoutAll = 'logout_all',
  ReuseDetected = 'reuse_detected',
  Expired = 'expired',
}
