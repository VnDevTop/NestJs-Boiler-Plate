export enum RefreshTokenRevokedReason {
  Rotated = 'rotated',
  Logout = 'logout',
  LogoutAll = 'logout_all',
  DeviceRevoked = 'device_revoked',
  ReuseDetected = 'reuse_detected',
  Expired = 'expired',
}
