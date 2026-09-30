export enum RefreshTokenRevokedReason {
  Rotated = 'rotated',
  Logout = 'logout',
  LogoutAll = 'logout_all',
  DeviceRevoked = 'device_revoked',
  ReuseDetected = 'reuse_detected',
  Expired = 'expired',
  /** Every session is revoked when a password is reset, including this device's. */
  PasswordChanged = 'password_changed',
}
